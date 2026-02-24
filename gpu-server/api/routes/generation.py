import logging
import threading
import torch
import base64
from io import BytesIO
from typing import Optional
from PIL import Image as PILImage
import numpy as np

# ── GFPGAN (lazy load) ────────────────────────────────────────────────────────
_face_restorer = None

def get_face_restorer():
    global _face_restorer
    if _face_restorer is None:
        try:
            from gfpgan import GFPGANer
            import os
            model_path = "/root/urpm/models/GFPGANv1.4.pth"
            if not os.path.exists(model_path):
                os.makedirs("/root/urpm/models", exist_ok=True)
                import urllib.request
                urllib.request.urlretrieve(
                    "https://github.com/TencentARC/GFPGAN/releases/download/v1.3.0/GFPGANv1.4.pth",
                    model_path,
                )
            _face_restorer = GFPGANer(
                model_path=model_path, upscale=1, arch="clean", channel_multiplier=2
            )
            logger.info("GFPGAN face restorer loaded")
        except Exception as e:
            logger.warning(f"GFPGAN not available: {e}")
            _face_restorer = False
    return _face_restorer if _face_restorer is not False else None


def apply_face_restore(pil_image, strength=0.2):
    """Apply GFPGAN face restoration (light strength for realism)."""
    restorer = get_face_restorer()
    if restorer is None:
        return pil_image
    try:
        import cv2
        np_img = np.array(pil_image)
        if np_img.shape[2] == 4:
            np_img = cv2.cvtColor(np_img, cv2.COLOR_RGBA2BGR)
        else:
            np_img = cv2.cvtColor(np_img, cv2.COLOR_RGB2BGR)
        _, _, restored = restorer.enhance(
            np_img, has_aligned=False, only_center_face=False, paste_back=True, weight=strength
        )
        if restored is not None:
            return PILImage.fromarray(cv2.cvtColor(restored, cv2.COLOR_BGR2RGB))
    except Exception as e:
        logger.warning(f"Face restore failed: {e}")
    return pil_image


# ── img2img pipeline (lazy, built from existing components) ──────────────────
_img2img_pipe = None

def _get_img2img_pipe(model_loader):
    global _img2img_pipe
    if _img2img_pipe is None:
        from diffusers import StableDiffusionImg2ImgPipeline
        base = model_loader.get_pipeline()
        _img2img_pipe = StableDiffusionImg2ImgPipeline(**base.components).to("cuda")
        _img2img_pipe.enable_attention_slicing()
        _img2img_pipe.enable_vae_slicing()
        logger.info("[hires_fix] img2img pipeline ready for high-res fix pass")
    return _img2img_pipe


def apply_hires_fix(
    image: PILImage.Image,
    prompt: str,
    negative_prompt: str,
    scale: float,
    denoise: float,
    steps: int,
    guidance: float,
    generator,
    model_loader,
) -> PILImage.Image:
    """Upscale then run img2img refinement pass (high-res fix)."""
    try:
        new_w = int((image.width  * scale) // 8) * 8
        new_h = int((image.height * scale) // 8) * 8
        upscaled = image.resize((new_w, new_h), PILImage.LANCZOS)
        logger.info(f"[hires_fix] {image.width}x{image.height} -> {new_w}x{new_h}, denoise={denoise}, steps={steps}")

        pipe = _get_img2img_pipe(model_loader)
        result = pipe(
            prompt=prompt,
            image=upscaled,
            negative_prompt=negative_prompt,
            strength=denoise,
            num_inference_steps=steps,
            guidance_scale=guidance,
            generator=generator,
        )
        return result.images[0]
    except Exception as e:
        logger.warning(f"[hires_fix] Second pass failed, returning first-pass image: {e}")
        return image


# ── Default negative prompt ───────────────────────────────────────────────────
NEGATIVE_DEFAULT = (
    "(worst quality, low quality:1.4), blurry, bad anatomy, extra fingers, extra limbs, "
    "poorly drawn hands, deformed, jpeg artifacts, oversharpened, plastic skin, "
    "watermark, text, logo, cgi, 3d render, cartoon, doll skin, smooth skin"
)

from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel

from core.config import settings
# GPU Resource Broker
from core.broker.gpu_resource_broker import get_broker, GPUWorkload

from core.task_manager import task_manager
from api.models.requests import ImageRequest

logger = logging.getLogger(__name__)
router = APIRouter()


def _build_generator(seed, device="cuda"):
    if seed is not None:
        return torch.Generator(device=device).manual_seed(seed)
    return None


def _generate_one(pipe, prompt, negative_prompt, steps, guidance, height, width, generator, clip_skip=1):
    result = pipe(
        prompt,
        negative_prompt=negative_prompt,
        num_inference_steps=steps,
        guidance_scale=guidance,
        height=height,
        width=width,
        num_images_per_prompt=1,
        generator=generator,
        clip_skip=clip_skip if clip_skip > 1 else None,
    )
    return result.images[0]


def _process_image(
    image: PILImage.Image,
    prompt: str,
    negative_prompt: str,
    task_data: dict,
    generator,
    model_loader,
) -> str:
    """Apply hires-fix and face restore, return base64 PNG."""
    # High-res fix
    do_hires = task_data.get("hires_fix", True)
    if do_hires:
        hires_scale   = task_data.get("hires_scale",   1.75)
        hires_denoise = task_data.get("hires_denoise", 0.4)
        hires_steps   = task_data.get("hires_steps",   28)
        guidance      = task_data.get("guidance_scale", 6.8)
        image = apply_hires_fix(
            image, prompt, negative_prompt,
            hires_scale, hires_denoise, hires_steps, guidance, generator, model_loader
        )

    # Face restore
    if task_data.get("face_restore", True):
        strength = task_data.get("face_restore_strength", 0.2)
        image = apply_face_restore(image, strength=strength)

    buf = BytesIO()
    image.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


def generate_image_task(task_id, task_data, error_manager, memory_manager, model_loader):
    """Background task: generate image(s) with hires fix + face restore."""
    webhook_url = task_data.get("webhook")
    track_id    = task_data.get("track_id")

    try:
        if webhook_url:
            from api.utils.webhook import send_webhook
            send_webhook(webhook_url, {"id": task_id, "status": "processing",
                                       "eta": task_manager.get_task(task_id)["eta"],
                                       "output": [], "track_id": track_id})

        prompt   = task_data["prompt"]
        steps    = min(task_data["num_inference_steps"], settings.MAX_STEPS)
        guidance = task_data["guidance_scale"]
        height   = min(task_data["height"], settings.MAX_RESOLUTION)
        width    = min(task_data["width"],  settings.MAX_RESOLUTION)
        samples  = min(task_data["samples"], settings.MAX_SAMPLES)
        seed     = task_data.get("seed")
        negative = task_data.get("negative_prompt") or NEGATIVE_DEFAULT
        sampler  = task_data.get("sampler")

        can_gen, max_samples = memory_manager.can_generate(height, width, samples, steps)
        if not can_gen:
            if max_samples < 1:
                raise Exception("Insufficient GPU memory for generation")
            samples = max_samples

        task_manager.update_task(task_id, progress=10)

        generator = _build_generator(seed)
        output_images = []

        # Set sampler if requested
        if sampler:
            model_loader.set_sampler(sampler)

        with model_loader.memory_managed_generation() as pipe:
            for i in range(samples):
                try:
                    progress = 10 + int(80 * (i + 1) / samples)
                    task_manager.update_task(task_id, progress=progress)

                    image = _generate_one(pipe, prompt, negative, steps, guidance, height, width, generator)
                    img_str = _process_image(image, prompt, negative, task_data, generator, model_loader)
                    output_images.append(img_str)
                    memory_manager.clear_memory()

                except torch.cuda.OutOfMemoryError as e:
                    error_manager.log_error("cuda_oom", str(e), {"image": i + 1}, task_id)
                    if i == 0:
                        raise Exception("GPU out of memory. Please reduce resolution or try again later.")
                    break
                except Exception as e:
                    error_manager.log_error("gen_error", str(e), {"image": i + 1}, task_id)
                    if i == 0:
                        raise
                    break

        task_manager.update_task(task_id, status="success", output=output_images, progress=100)

        if webhook_url:
            from api.utils.webhook import send_webhook
            send_webhook(webhook_url, {"id": task_id, "status": "success",
                                       "output": output_images, "track_id": track_id})

    except Exception as e:
        error_manager.log_error("task_failed", str(e), {"task_id": task_id}, task_id)
        task_manager.update_task(task_id, status="failed", error=str(e))
        if webhook_url:
            from api.utils.webhook import send_webhook
            send_webhook(webhook_url, {"id": task_id, "status": "failed",
                                       "error": str(e), "track_id": track_id})
    finally:
        # Release broker lease (best-effort from background thread)
        _lease_id = task_data.get("_broker_lease_id")
        if _lease_id:
            import asyncio
            try:
                _broker = get_broker()
                loop = asyncio.new_event_loop()
                loop.run_until_complete(_broker.release(_lease_id))
                loop.close()
            except Exception as _e:
                logger.warning(f"[broker] Failed to release lease {_lease_id}: {_e}")


@router.post("/generate")
async def generate_image(request: ImageRequest, req: Request):
    """Generate images — primary pass + optional high-res fix."""
    error_manager = req.app.state.error_manager
    memory_manager = req.app.state.memory_manager
    model_loader   = req.app.state.model_loader

    if not model_loader.is_loaded():
        raise HTTPException(status_code=503, detail="Model not loaded. Please try again later.")

    if request.height > settings.MAX_RESOLUTION or request.width > settings.MAX_RESOLUTION:
        raise HTTPException(status_code=400,
                            detail=f"Maximum resolution is {settings.MAX_RESOLUTION}x{settings.MAX_RESOLUTION}")

    if request.samples > settings.MAX_SAMPLES:
        raise HTTPException(status_code=400, detail=f"Maximum {settings.MAX_SAMPLES} samples per request")

    if not request.webhook:
        # Acquire GPU lease from broker
        broker = get_broker()
        lease = await broker.acquire(GPUWorkload.IMAGE_GEN, "sync txt2img", timeout=60.0)
        if lease is None:
            raise HTTPException(status_code=503, detail="GPU busy. Please try again shortly.")
        # ── Synchronous path ─────────────────────────────────────────────────
        try:
            can_gen, max_samples = memory_manager.can_generate(
                request.height, request.width, request.samples, request.num_inference_steps
            )
            if not can_gen:
                if max_samples < 1:
                    raise HTTPException(status_code=503, detail="Insufficient GPU memory.")
                samples = max_samples
            else:
                samples = request.samples

            generator = _build_generator(request.seed)
            negative  = request.negative_prompt or NEGATIVE_DEFAULT
            task_data = request.dict()

            # Apply sampler if requested
            if request.sampler:
                model_loader.set_sampler(request.sampler)

            output_images = []

            with model_loader.memory_managed_generation() as pipe:
                for i in range(samples):
                    try:
                        image = _generate_one(
                            pipe, request.prompt, negative,
                            request.num_inference_steps, request.guidance_scale,
                            request.height, request.width, generator,
                            clip_skip=request.clip_skip
                        )
                        img_str = _process_image(image, request.prompt, negative, task_data, generator, model_loader)
                        output_images.append(img_str)
                        memory_manager.clear_memory()

                    except torch.cuda.OutOfMemoryError as e:
                        if i == 0:
                            await broker.release(lease.lease_id)
                        raise HTTPException(status_code=503, detail="GPU out of memory. Reduce resolution or try again.")
                        break

            result = {"image": output_images[0]} if len(output_images) == 1 else {"images": output_images}
            await broker.release(lease.lease_id)
            return result

        except HTTPException:
            if lease:
                await broker.release(lease.lease_id)
            raise
        except Exception as e:
            if lease:
                await broker.release(lease.lease_id)
            logger.error(f"Direct generation error: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    else:
        # ── Async / webhook path ─────────────────────────────────────────────
        # Acquire GPU lease for async generation
        broker = get_broker()
        lease = await broker.acquire(GPUWorkload.IMAGE_GEN, "async txt2img", timeout=60.0)
        if lease is None:
            raise HTTPException(status_code=503, detail="GPU busy. Please try again shortly.")
        task_data = request.dict()
        task_data["_broker_lease_id"] = lease.lease_id
        task_id   = task_manager.create_task(task_data)
        thread = threading.Thread(
            target=generate_image_task,
            args=(task_id, task_data, error_manager, memory_manager, model_loader),
            daemon=True,
        )
        thread.start()
        task = task_manager.get_task(task_id)
        return {"id": task_id, "eta": task["eta"], "output": [], "status": "processing"}


@router.get("/fetch/{task_id}")
async def fetch_task(task_id: str):
    task = task_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    response = {
        "id": task_id, "eta": task["eta"], "output": task["output"],
        "status": task["status"], "progress": task.get("progress", 0)
    }
    if task.get("error"):
        response["error"] = task["error"]
    return response
