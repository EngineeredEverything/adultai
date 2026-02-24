"""
img2img + Inpainting routes for AdultAI GPU API
Reuses the already-loaded SD model via from_pipe() — no extra VRAM needed.
"""
import io
import uuid
import logging
import asyncio
import aiohttp
import torch
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from PIL import Image
from diffusers import StableDiffusionImg2ImgPipeline, StableDiffusionInpaintPipeline
import os

logger = logging.getLogger(__name__)
router = APIRouter()

BUNNY_API_KEY    = os.environ.get("BUNNY_API_KEY",    "01584fa8-be3f-4f8d-bae3f5080e2c-9d54-41dc")
BUNNY_ZONE       = os.environ.get("BUNNY_STORAGE_ZONE", "storage-adultai")
BUNNY_HOST       = os.environ.get("BUNNY_STORAGE_HOST", "la.storage.bunnycdn.com")
BUNNY_CDN        = os.environ.get("BUNNY_CDN_URL",    "https://adultai-com.b-cdn.net")

NEGATIVE_DEFAULT = (
    "deformed, ugly, bad anatomy, bad hands, extra fingers, mutated, "
    "poorly drawn face, blurry, watermark, text, logo, lowres, worst quality, "
    "two heads, duplicate, cloned face, disfigured"
)

# Lazy pipeline cache — built once per process from existing components
_img2img_pipe: Optional[StableDiffusionImg2ImgPipeline] = None
_inpaint_pipe:  Optional[StableDiffusionInpaintPipeline] = None


def _get_img2img_pipe(model_loader) -> StableDiffusionImg2ImgPipeline:
    global _img2img_pipe
    if _img2img_pipe is None:
        logger.info("[img2img] Building img2img pipeline from loaded components...")
        base = model_loader.get_pipeline()
        _img2img_pipe = StableDiffusionImg2ImgPipeline(**base.components).to("cuda")
        _img2img_pipe.enable_attention_slicing()
        _img2img_pipe.enable_vae_slicing()
        logger.info("[img2img] Pipeline ready.")
    return _img2img_pipe


def _get_inpaint_pipe(model_loader) -> StableDiffusionInpaintPipeline:
    global _inpaint_pipe
    if _inpaint_pipe is None:
        logger.info("[inpaint] Building inpaint pipeline from loaded components...")
        base = model_loader.get_pipeline()
        _inpaint_pipe = StableDiffusionInpaintPipeline(**base.components).to("cuda")
        _inpaint_pipe.enable_attention_slicing()
        _inpaint_pipe.enable_vae_slicing()
        logger.info("[inpaint] Pipeline ready.")
    return _inpaint_pipe


async def _download_image(url: str) -> Image.Image:
    async with aiohttp.ClientSession() as session:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=20)) as r:
            r.raise_for_status()
            data = await r.read()
    return Image.open(io.BytesIO(data)).convert("RGB")


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


# ── img2img ────────────────────────────────────────────────────────────────────

class Img2ImgRequest(BaseModel):
    prompt: str = Field(..., description="Describe the desired output")
    image_url: str = Field(..., description="Source image URL")
    negative_prompt: str = Field(default=NEGATIVE_DEFAULT)
    strength: float  = Field(default=0.65, ge=0.1, le=0.99,
                              description="0.1=subtle change, 0.99=heavy remix")
    steps: int       = Field(default=30, ge=10, le=80)
    guidance_scale: float = Field(default=7.5, ge=1.0, le=20.0)
    seed: Optional[int] = None
    width:  Optional[int] = Field(default=None, description="Resize output width")
    height: Optional[int] = Field(default=None, description="Resize output height")


@router.post("/img2img", summary="Image-to-Image (edit outfit / scene / expression)")
async def img2img(req: Img2ImgRequest, request: Request):
    """
    Transform an existing image guided by a prompt.
    - strength 0.3–0.5 = subtle (keep most of the original)
    - strength 0.6–0.8 = moderate (change details like outfit or background)
    - strength 0.85–0.99 = heavy remix (changes most of the image)
    """
    model_loader = request.app.state.model_loader
    if not model_loader.is_loaded():
        raise HTTPException(status_code=503, detail="Model not loaded")

    try:
        pipe = _get_img2img_pipe(model_loader)

        # Download + prep source image
        source = await _download_image(req.image_url)
        w = ((req.width  or source.width)  // 8) * 8
        h = ((req.height or source.height) // 8) * 8
        source = source.resize((w, h), Image.LANCZOS)

        generator = torch.Generator(device="cuda")
        seed = req.seed if req.seed is not None else torch.randint(0, 2**31, (1,)).item()
        generator.manual_seed(seed)

        # Clear VRAM before running
        torch.cuda.empty_cache()

        result = await asyncio.get_event_loop().run_in_executor(None, lambda: pipe(
            prompt=req.prompt,
            image=source,
            negative_prompt=req.negative_prompt,
            strength=req.strength,
            num_inference_steps=req.steps,
            guidance_scale=req.guidance_scale,
            generator=generator,
        ))

        torch.cuda.empty_cache()

        output_url = await _upload_to_cdn(_pil_to_bytes(result.images[0]), "img2img")
        return {"success": True, "image_url": output_url, "seed": seed}

    except torch.cuda.OutOfMemoryError:
        torch.cuda.empty_cache()
        raise HTTPException(status_code=503, detail="GPU out of memory — try a smaller image or lower strength")
    except Exception as e:
        logger.error(f"[img2img] error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Inpainting ─────────────────────────────────────────────────────────────────

class InpaintRequest(BaseModel):
    prompt: str      = Field(..., description="Describe what fills the masked area")
    image_url: str   = Field(..., description="Source image URL")
    mask_url: str    = Field(..., description="Mask URL — white=replace, black=keep")
    negative_prompt: str = Field(default=NEGATIVE_DEFAULT)
    strength: float  = Field(default=0.99, ge=0.5, le=1.0)
    steps: int       = Field(default=30, ge=10, le=80)
    guidance_scale: float = Field(default=7.5)
    seed: Optional[int] = None


@router.post("/inpaint", summary="Inpainting (paint mask to replace specific area)")
async def inpaint(req: InpaintRequest, request: Request):
    """
    Replace a masked region using a text prompt.
    Mask: white pixels = replace, black pixels = keep unchanged.
    Use for changing clothes, background, or any specific region.
    """
    model_loader = request.app.state.model_loader
    if not model_loader.is_loaded():
        raise HTTPException(status_code=503, detail="Model not loaded")

    try:
        pipe = _get_inpaint_pipe(model_loader)

        source, mask_img = await asyncio.gather(
            _download_image(req.image_url),
            _download_image(req.mask_url),
        )

        w = (source.width  // 8) * 8
        h = (source.height // 8) * 8
        source   = source.resize((w, h), Image.LANCZOS)
        mask_img = mask_img.convert("L").resize((w, h), Image.NEAREST)

        generator = torch.Generator(device="cuda")
        seed = req.seed if req.seed is not None else torch.randint(0, 2**31, (1,)).item()
        generator.manual_seed(seed)

        torch.cuda.empty_cache()

        result = await asyncio.get_event_loop().run_in_executor(None, lambda: pipe(
            prompt=req.prompt,
            image=source,
            mask_image=mask_img,
            negative_prompt=req.negative_prompt,
            strength=req.strength,
            num_inference_steps=req.steps,
            guidance_scale=req.guidance_scale,
            generator=generator,
        ))

        torch.cuda.empty_cache()

        output_url = await _upload_to_cdn(_pil_to_bytes(result.images[0]), "inpaint")
        return {"success": True, "image_url": output_url, "seed": seed}

    except torch.cuda.OutOfMemoryError:
        torch.cuda.empty_cache()
        raise HTTPException(status_code=503, detail="GPU out of memory")
    except Exception as e:
        logger.error(f"[inpaint] error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
