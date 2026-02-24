"""
Upscaling route for AdultAI GPU API
Uses Real-ESRGAN if available, falls back to high-quality Lanczos + sharpen.
"""
import io
import uuid
import logging
import asyncio
import aiohttp
import os
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from PIL import Image, ImageFilter, ImageEnhance

logger = logging.getLogger(__name__)
router = APIRouter()

BUNNY_API_KEY = os.environ.get("BUNNY_API_KEY",    "01584fa8-be3f-4f8d-bae3f5080e2c-9d54-41dc")
BUNNY_ZONE    = os.environ.get("BUNNY_STORAGE_ZONE", "storage-adultai")
BUNNY_HOST    = os.environ.get("BUNNY_STORAGE_HOST", "la.storage.bunnycdn.com")
BUNNY_CDN     = os.environ.get("BUNNY_CDN_URL",    "https://adultai-com.b-cdn.net")

# Try to load Real-ESRGAN at import time
_esrgan = None
try:
    import numpy as np
    from basicsr.archs.rrdbnet_arch import RRDBNet
    from realesrgan import RealESRGANer
    _esrgan_model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64,
                             num_block=23, num_grow_ch=32, scale=4)
    _esrgan_weights = "/root/urpm/model/RealESRGAN_x4plus.pth"
    if os.path.exists(_esrgan_weights):
        _esrgan = RealESRGANer(
            scale=4,
            model_path=_esrgan_weights,
            model=_esrgan_model,
            tile=512, tile_pad=10, pre_pad=0, half=True,
        )
        logger.info("[upscale] Real-ESRGAN loaded ✓")
    else:
        logger.info("[upscale] Real-ESRGAN weights not found — using Lanczos fallback")
except Exception as e:
    logger.info(f"[upscale] Real-ESRGAN not available ({e}) — using Lanczos fallback")


async def _download_image(url: str) -> Image.Image:
    async with aiohttp.ClientSession() as session:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=20)) as r:
            r.raise_for_status()
            data = await r.read()
    return Image.open(io.BytesIO(data)).convert("RGB")


async def _upload_to_cdn(buf: bytes, folder: str) -> str:
    filename = f"{folder}/{uuid.uuid4()}.png"
    cdn_url = f"https://{BUNNY_HOST}/{BUNNY_ZONE}/{filename}"
    async with aiohttp.ClientSession() as session:
        async with session.put(
            cdn_url, data=buf,
            headers={"AccessKey": BUNNY_API_KEY, "Content-Type": "image/png"},
            timeout=aiohttp.ClientTimeout(total=30),
        ) as r:
            r.raise_for_status()
    return f"{BUNNY_CDN}/{filename}"


def _pil_to_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _upscale_sync(source: Image.Image, scale: int, enhance: bool) -> tuple[Image.Image, str]:
    """Run upscaling synchronously (called via executor)."""
    if _esrgan is not None:
        try:
            import numpy as np
            arr = np.array(source)[:, :, ::-1]  # RGB→BGR
            output_arr, _ = _esrgan.enhance(arr, outscale=scale)
            output = Image.fromarray(output_arr[:, :, ::-1])  # BGR→RGB
            method = "realesrgan"
        except Exception as e:
            logger.warning(f"[upscale] Real-ESRGAN failed ({e}), falling back to Lanczos")
            output = source.resize(
                (source.width * scale, source.height * scale), Image.LANCZOS
            )
            method = "lanczos"
    else:
        output = source.resize(
            (source.width * scale, source.height * scale), Image.LANCZOS
        )
        method = "lanczos"

    if enhance:
        output = output.filter(ImageFilter.UnsharpMask(radius=1.5, percent=130, threshold=3))
        output = ImageEnhance.Sharpness(output).enhance(1.2)
        output = ImageEnhance.Contrast(output).enhance(1.05)

    return output, method


class UpscaleRequest(BaseModel):
    image_url: str  = Field(..., description="URL of the image to upscale")
    scale: int      = Field(default=2, ge=2, le=4, description="Upscale factor: 2 or 4")
    enhance: bool   = Field(default=True, description="Apply sharpening pass after upscale")


@router.post("/upscale", summary="Upscale image 2x or 4x (Real-ESRGAN / Lanczos)")
async def upscale(req: UpscaleRequest, request: Request):
    """
    Upscale an image 2× or 4×.
    Uses Real-ESRGAN AI upscaling if available, otherwise high-quality Lanczos.
    """
    try:
        source = await _download_image(req.image_url)
        output, method = await asyncio.get_event_loop().run_in_executor(
            None, lambda: _upscale_sync(source, req.scale, req.enhance)
        )
        url = await _upload_to_cdn(_pil_to_bytes(output), "upscaled")
        return {
            "success": True,
            "image_url": url,
            "original_size": f"{source.width}x{source.height}",
            "output_size":   f"{output.width}x{output.height}",
            "scale":  req.scale,
            "method": method,
        }
    except Exception as e:
        logger.error(f"[upscale] error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
