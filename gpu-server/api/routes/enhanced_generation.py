"""
Enhanced Stable Diffusion generation with:
- Negative prompting (auto-inject defaults)
- Sampler/scheduler selection
- Hires fix (generate small → img2img upscale)
- Face restore (GFPGAN)
- Prompt weighting (Compel)
- Seed tracking
- Pipeline steps tracking
"""
import io
import uuid
import logging
import asyncio
import aiohttp
import os
import torch
import numpy as np
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from PIL import Image
from diffusers import (
    StableDiffusionPipeline,
    StableDiffusionImg2ImgPipeline,
    DPMSolverMultistepScheduler,
    EulerAncestralDiscreteScheduler,
    EulerDiscreteScheduler,
    DDIMScheduler,
    PNDMScheduler,
    LMSDiscreteScheduler,
    UniPCMultistepScheduler,
    HeunDiscreteScheduler,
    KDPM2AncestralDiscreteScheduler,
)
from compel import Compel

logger = logging.getLogger(__name__)
router = APIRouter()

BUNNY_API_KEY = os.environ.get("BUNNY_API_KEY", "01584fa8-be3f-4f8d-bae3f5080e2c-9d54-41dc")
BUNNY_ZONE = os.environ.get("BUNNY_STORAGE_ZONE", "storage-adultai")
BUNNY_HOST = os.environ.get("BUNNY_STORAGE_HOST", "la.storage.bunnycdn.com")
BUNNY_CDN = os.environ.get("BUNNY_CDN_URL", "https://adultai-com.b-cdn.net")

# ── Default negative prompt ──────────────────────────────────────────────────
DEFAULT_NEGATIVE = (
    "low quality, worst quality, blurry, bad anatomy, extra fingers, extra limbs, "
    "deformed, watermark, text, cropped, jpeg artifacts, poorly drawn face, "
    "mutated, disfigured, two heads, duplicate, cloned face, logo, lowres"
)

# ── Scheduler map ────────────────────────────────────────────────────────────
SCHEDULER_MAP = {
    "dpmpp_2m_karras": lambda cfg: DPMSolverMultistepScheduler.from_config(cfg, use_karras_sigmas=True),
    "dpmpp_2m": lambda cfg: DPMSolverMultistepScheduler.from_config(cfg),
    "euler_a": lambda cfg: EulerAncestralDiscreteScheduler.from_config(cfg),
    "euler": lambda cfg: EulerDiscreteScheduler.from_config(cfg),
    "ddim": lambda cfg: DDIMScheduler.from_config(cfg),
    "pndm": lambda cfg: PNDMScheduler.from_config(cfg),
    "lms": lambda cfg: LMSDiscreteScheduler.from_config(cfg),
    "unipc": lambda cfg: UniPCMultistepScheduler.from_config(cfg),
    "heun": lambda cfg: HeunDiscreteScheduler.from_config(cfg),
    "dpm2_a_karras": lambda cfg: KDPM2AncestralDiscreteScheduler.from_config(cfg, use_karras_sigmas=True),
}

# ── GFPGAN face restore ─────────────────────────────────────────────────────
_gfpgan = None

def _load_gfpgan():
    global _gfpgan
    if _gfpgan is not None:
        return _gfpgan
    try:
        from gfpgan import GFPGANer
        model_path = "/root/urpm/model/GFPGANv1.4.pth"
        if os.path.exists(model_path):
            _gfpgan = GFPGANer(
                model_path=model_path,
                upscale=1,  # Don't upscale, just restore faces
                arch="clean",
                channel_multiplier=2,
                bg_upsampler=None,
            )
            logger.info("[face_restore] GFPGAN loaded")
            return _gfpgan
    except Exception as e:
        logger.warning(f"[face_restore] GFPGAN not available: {e}")
    return None


def _apply_face_restore(pil_img: Image.Image, strength: float = 0.5) -> Image.Image:
    """Apply GFPGAN face restoration to a PIL image."""
    gfpgan = _load_gfpgan()
    if gfpgan is None:
        logger.warning("[face_restore] Skipping — GFPGAN not loaded")
        return pil_img

    try:
        img_np = np.array(pil_img)[:, :, ::-1]  # RGB→BGR
        _, _, restored = gfpgan.enhance(
            img_np,
            has_aligned=False,
            only_center_face=False,
            paste_back=True,
            weight=strength,
        )
        result = Image.fromarray(restored[:, :, ::-1])  # BGR→RGB
        logger.info("[face_restore] Applied successfully")
        return result
    except Exception as e:
        logger.warning(f"[face_restore] Failed: {e}")
        return pil_img


# ── Cached pipelines ─────────────────────────────────────────────────────────
_img2img_pipe_cache = None
_compel_cache = None
_original_scheduler_config = None


def _get_compel(pipe):
    global _compel_cache
    if _compel_cache is None:
        _compel_cache = Compel(tokenizer=pipe.tokenizer, text_encoder=pipe.text_encoder)
    return _compel_cache


def _set_scheduler(pipe, sampler_name: str):
    global _original_scheduler_config
    if _original_scheduler_config is None:
        _original_scheduler_config = pipe.scheduler.config

    if sampler_name in SCHEDULER_MAP:
        pipe.scheduler = SCHEDULER_MAP[sampler_name](_original_scheduler_config)
        logger.debug(f"[scheduler] Set to {sampler_name}")
    else:
        logger.warning(f"[scheduler] Unknown sampler '{sampler_name}', keeping default")


def _get_img2img_from(model_loader):
    global _img2img_pipe_cache
    if _img2img_pipe_cache is None:
        base = model_loader.get_pipeline()
        _img2img_pipe_cache = StableDiffusionImg2ImgPipeline(**base.components).to("cuda")
        _img2img_pipe_cache.enable_attention_slicing()
        _img2img_pipe_cache.enable_vae_slicing()
    return _img2img_pipe_cache


async def _upload_to_cdn(buf: bytes, folder: str, ext: str = "png") -> str:
    filename = f"{folder}/{uuid.uuid4()}.{ext}"
    cdn_url = f"https://{BUNNY_HOST}/{BUNNY_ZONE}/{filename}"
    async with aiohttp.ClientSession() as session:
        async with session.put(
            cdn_url, data=buf,
            headers={"AccessKey": BUNNY_API_KEY, "Content-Type": f"image/{ext}"},
            timeout=aiohttp.ClientTimeout(total=30),
        ) as r:
            r.raise_for_status()
    return f"{BUNNY_CDN}/{filename}"


def _pil_to_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


# ── Presets ──────────────────────────────────────────────────────────────────
PRESETS = {
    "realistic": {
        "sampler": "dpmpp_2m_karras",
        "steps": 28,
        "cfg": 6.5,
        "negative_prompt": DEFAULT_NEGATIVE,
        "hires_fix": True,
        "face_restore": True,
        "face_restore_strength": 0.4,
    },
    "stylized": {
        "sampler": "euler_a",
        "steps": 22,
        "cfg": 7.5,
        "negative_prompt": DEFAULT_NEGATIVE,
        "hires_fix": False,
        "face_restore": False,
    },
    "quality": {
        "sampler": "dpmpp_2m_karras",
        "steps": 40,
        "cfg": 7.0,
        "negative_prompt": DEFAULT_NEGATIVE,
        "hires_fix": True,
        "face_restore": True,
        "face_restore_strength": 0.5,
    },
}


# ── Request model ────────────────────────────────────────────────────────────

class EnhancedGenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000)
    negative_prompt: Optional[str] = Field(default=None, description="Negative prompt (auto-injected if empty)")
    width: int = Field(default=512, ge=256, le=1024)
    height: int = Field(default=768, ge=256, le=1024)
    steps: int = Field(default=28, ge=10, le=80)
    cfg: float = Field(default=6.5, ge=1.0, le=20.0, description="Guidance scale")
    sampler: str = Field(default="dpmpp_2m_karras", description="Sampler name")
    seed: Optional[int] = Field(default=None, ge=0)
    samples: int = Field(default=1, ge=1, le=4)

    # Advanced options
    hires_fix: bool = Field(default=False, description="Generate at lower res then upscale + denoise")
    hires_scale: float = Field(default=1.5, ge=1.25, le=2.0, description="Hires upscale factor")
    hires_denoise: float = Field(default=0.35, ge=0.2, le=0.6, description="Hires denoise strength")
    hires_steps: int = Field(default=15, ge=5, le=30, description="Hires refinement steps")

    face_restore: bool = Field(default=False, description="Apply GFPGAN face restoration")
    face_restore_strength: float = Field(default=0.4, ge=0.1, le=0.8)

    preset: Optional[str] = Field(default=None, description="Use a preset: realistic, stylized, quality")

    use_prompt_weighting: bool = Field(default=True, description="Enable (term:1.2) style weighting via Compel")


class EnhancedGenerateResponse(BaseModel):
    success: bool
    images: List[str]  # CDN URLs
    seed: int
    settings_used: dict
    pipeline_steps: List[str]


# ── Endpoint ─────────────────────────────────────────────────────────────────

@router.post("/generate/advanced", response_model=EnhancedGenerateResponse,
             summary="Advanced generation with negative prompt, samplers, hires fix, face restore")
async def advanced_generate(req: EnhancedGenerateRequest, request: Request):
    model_loader = request.app.state.model_loader
    memory_manager = request.app.state.memory_manager

    if not model_loader.is_loaded():
        raise HTTPException(status_code=503, detail="Model not loaded")

    # Apply preset if specified
    if req.preset and req.preset in PRESETS:
        p = PRESETS[req.preset]
        if req.negative_prompt is None:
            req.negative_prompt = p.get("negative_prompt", DEFAULT_NEGATIVE)
        req.sampler = p.get("sampler", req.sampler)
        req.steps = p.get("steps", req.steps)
        req.cfg = p.get("cfg", req.cfg)
        req.hires_fix = p.get("hires_fix", req.hires_fix)
        req.face_restore = p.get("face_restore", req.face_restore)
        req.face_restore_strength = p.get("face_restore_strength", req.face_restore_strength)

    # Auto-inject negative prompt
    negative = req.negative_prompt or DEFAULT_NEGATIVE

    pipeline_steps = ["base"]
    pipe = model_loader.get_pipeline()

    # Set scheduler
    _set_scheduler(pipe, req.sampler)

    # Determine generation resolution
    if req.hires_fix:
        # Generate at reduced resolution first
        gen_w = int(req.width / req.hires_scale)
        gen_h = int(req.height / req.hires_scale)
        gen_w = (gen_w // 8) * 8
        gen_h = (gen_h // 8) * 8
        # Clamp minimum
        gen_w = max(gen_w, 256)
        gen_h = max(gen_h, 256)
        pipeline_steps.append("hires_fix")
    else:
        gen_w = (req.width // 8) * 8
        gen_h = (req.height // 8) * 8

    if req.face_restore:
        pipeline_steps.append("face_restore")

    # Setup seed
    seed = req.seed if req.seed is not None else torch.randint(0, 2**31, (1,)).item()
    generator = torch.Generator(device="cuda").manual_seed(seed)

    # Build prompt embeddings with Compel (supports weighting)
    prompt_embeds = None
    negative_embeds = None
    if req.use_prompt_weighting:
        try:
            compel = _get_compel(pipe)
            prompt_embeds = compel.build_conditioning_tensor(req.prompt)
            negative_embeds = compel.build_conditioning_tensor(negative)
            # Pad to same length
            prompt_embeds, negative_embeds = compel.pad_conditioning_tensors_to_same_length(
                [prompt_embeds, negative_embeds]
            )
        except Exception as e:
            logger.warning(f"[compel] Prompt weighting failed ({e}), falling back to plain prompts")
            prompt_embeds = None
            negative_embeds = None

    try:
        torch.cuda.empty_cache()

        output_images = []
        for i in range(req.samples):
            # ── Step 1: Base generation ──
            gen_kwargs = {
                "num_inference_steps": req.steps,
                "guidance_scale": req.cfg,
                "height": gen_h,
                "width": gen_w,
                "num_images_per_prompt": 1,
                "generator": generator,
            }

            if prompt_embeds is not None:
                gen_kwargs["prompt_embeds"] = prompt_embeds
                gen_kwargs["negative_prompt_embeds"] = negative_embeds
            else:
                gen_kwargs["prompt"] = req.prompt
                gen_kwargs["negative_prompt"] = negative

            result = await asyncio.get_event_loop().run_in_executor(
                None, lambda: pipe(**gen_kwargs)
            )
            img = result.images[0]

            # ── Step 2: Hires fix ──
            if req.hires_fix:
                target_w = (req.width // 8) * 8
                target_h = (req.height // 8) * 8
                img_upscaled = img.resize((target_w, target_h), Image.LANCZOS)

                img2img_pipe = _get_img2img_from(model_loader)
                _set_scheduler(img2img_pipe, req.sampler)

                hires_kwargs = {
                    "image": img_upscaled,
                    "strength": req.hires_denoise,
                    "num_inference_steps": req.hires_steps,
                    "guidance_scale": req.cfg,
                    "generator": generator,
                }

                if prompt_embeds is not None:
                    hires_kwargs["prompt_embeds"] = prompt_embeds
                    hires_kwargs["negative_prompt_embeds"] = negative_embeds
                else:
                    hires_kwargs["prompt"] = req.prompt
                    hires_kwargs["negative_prompt"] = negative

                hires_result = await asyncio.get_event_loop().run_in_executor(
                    None, lambda: img2img_pipe(**hires_kwargs)
                )
                img = hires_result.images[0]

            # ── Step 3: Face restore ──
            if req.face_restore:
                img = await asyncio.get_event_loop().run_in_executor(
                    None, lambda: _apply_face_restore(img, req.face_restore_strength)
                )

            # Upload to CDN
            url = await _upload_to_cdn(_pil_to_bytes(img), "gallery/advanced")
            output_images.append(url)

            torch.cuda.empty_cache()

        settings_used = {
            "prompt": req.prompt,
            "negative_prompt": negative,
            "width": req.width,
            "height": req.height,
            "steps": req.steps,
            "cfg": req.cfg,
            "sampler": req.sampler,
            "hires_fix": req.hires_fix,
            "face_restore": req.face_restore,
            "preset": req.preset,
        }
        if req.hires_fix:
            settings_used["hires_scale"] = req.hires_scale
            settings_used["hires_denoise"] = req.hires_denoise
            settings_used["hires_steps"] = req.hires_steps
            settings_used["initial_resolution"] = f"{gen_w}x{gen_h}"
        if req.face_restore:
            settings_used["face_restore_strength"] = req.face_restore_strength

        return EnhancedGenerateResponse(
            success=True,
            images=output_images,
            seed=seed,
            settings_used=settings_used,
            pipeline_steps=pipeline_steps,
        )

    except torch.cuda.OutOfMemoryError:
        torch.cuda.empty_cache()
        raise HTTPException(status_code=503, detail="GPU out of memory — try smaller resolution or disable hires fix")
    except Exception as e:
        torch.cuda.empty_cache()
        logger.error(f"[advanced_generate] error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Also enhance the basic /generate endpoint with negative prompt + sampler ─

@router.post("/generate/face-restore", summary="Post-process: restore faces in an existing image")
async def face_restore_endpoint(request: Request, image_url: str = "", strength: float = 0.4):
    """Download an image and apply GFPGAN face restoration."""
    if not image_url:
        raise HTTPException(status_code=400, detail="image_url required")

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(image_url, timeout=aiohttp.ClientTimeout(total=20)) as r:
                r.raise_for_status()
                data = await r.read()

        img = Image.open(io.BytesIO(data)).convert("RGB")
        restored = await asyncio.get_event_loop().run_in_executor(
            None, lambda: _apply_face_restore(img, min(max(strength, 0.1), 0.8))
        )
        url = await _upload_to_cdn(_pil_to_bytes(restored), "facefix")
        return {"success": True, "image_url": url, "method": "gfpgan"}
    except Exception as e:
        logger.error(f"[face_restore] error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/samplers", summary="List available samplers")
async def list_samplers():
    """Return list of available sampler names."""
    return {
        "samplers": list(SCHEDULER_MAP.keys()),
        "default": "dpmpp_2m_karras",
        "presets": {k: {kk: vv for kk, vv in v.items() if kk != "negative_prompt"} for k, v in PRESETS.items()},
    }


@router.post("/face-restore", summary="Standalone face restore on any image URL")
async def standalone_face_restore(request: Request):
    """POST body: {image_url, strength}"""
    try:
        body = await request.json()
        image_url = body.get("image_url", "")
        strength = float(body.get("strength", 0.4))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    if not image_url:
        raise HTTPException(status_code=400, detail="image_url required")

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(image_url, timeout=aiohttp.ClientTimeout(total=20)) as r:
                r.raise_for_status()
                data = await r.read()

        img = Image.open(io.BytesIO(data)).convert("RGB")
        restored = await asyncio.get_event_loop().run_in_executor(
            None, lambda: _apply_face_restore(img, min(max(strength, 0.1), 0.8))
        )
        url = await _upload_to_cdn(_pil_to_bytes(restored), "facefix")
        return {"success": True, "image_url": url, "method": "gfpgan"}
    except Exception as e:
        logger.error(f"[face_restore] error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
