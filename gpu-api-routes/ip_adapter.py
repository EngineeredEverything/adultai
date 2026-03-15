"""
IP-Adapter face-consistent generation for AdultAI GPU API.
Generates images while preserving the face from a reference image.
"""
import io
import uuid
import logging
import asyncio
import aiohttp
import torch
import os
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from PIL import Image
from diffusers import StableDiffusionPipeline, StableDiffusionXLPipeline

logger = logging.getLogger(__name__)
router = APIRouter()

BUNNY_API_KEY = os.environ.get("BUNNY_API_KEY", "01584fa8-be3f-4f8d-bae3f5080e2c-9d54-41dc")
BUNNY_ZONE = os.environ.get("BUNNY_STORAGE_ZONE", "storage-adultai")
BUNNY_HOST = os.environ.get("BUNNY_STORAGE_HOST", "la.storage.bunnycdn.com")
BUNNY_CDN = os.environ.get("BUNNY_CDN_URL", "https://adultai-com.b-cdn.net")

# Model type mapping
SD15_MODELS = {"urpm", "dreamshaper"}
SDXL_MODELS = {"cyberrealistic_pony", "pony_realism", "damn_pony", "lustify", "pony_diffusion"}

# IP-Adapter weights
WEIGHTS_DIR = "/root/urpm/models/ip_adapter"
SD15_WEIGHT = os.path.join(WEIGHTS_DIR, "ip-adapter-plus-face_sd15.bin")
SDXL_WEIGHT = os.path.join(WEIGHTS_DIR, "ip-adapter-plus-face_sdxl_vit-h.safetensors")

class IPAdapterRequest(BaseModel):
    reference_image_url: str
    prompt: str
    negative_prompt: Optional[str] = None
    steps: int = Field(30, ge=10, le=50)
    cfg: float = Field(5.0, ge=1.0, le=20.0)
    width: int = Field(768, ge=512, le=1024)
    height: int = Field(1152, ge=512, le=1536)
    ip_adapter_scale: float = Field(0.6, ge=0.3, le=1.0)
    base_model: str = Field("cyberrealistic_pony")

async def _download_image(url: str) -> Image.Image:
    """Download image from URL."""
    async with aiohttp.ClientSession() as session:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as resp:
            if resp.status != 200:
                raise HTTPException(status_code=400, detail=f"Failed to download image: {resp.status}")
            data = await resp.read()
            return Image.open(io.BytesIO(data)).convert("RGB")

async def _upload_to_cdn(buf: bytes, folder: str, ext: str = "png") -> str:
    """Upload image to Bunny CDN."""
    filename = f"{uuid.uuid4().hex}.{ext}"
    path = f"{folder}/{filename}"
    
    async with aiohttp.ClientSession() as session:
        async with session.put(
            f"https://{BUNNY_HOST}/{BUNNY_ZONE}/{path}",
            data=buf,
            headers={"AccessKey": BUNNY_API_KEY},
            timeout=aiohttp.ClientTimeout(total=30),
        ) as resp:
            if resp.status not in (200, 201):
                raise HTTPException(status_code=500, detail="CDN upload failed")
            return f"{BUNNY_CDN}/{path}"

def get_model_type(model_name: str) -> str:
    """Determine if model is SD1.5 or SDXL."""
    if model_name in SD15_MODELS:
        return "sd15"
    elif model_name in SDXL_MODELS:
        return "sdxl"
    else:
        return "sdxl"

@router.post("/ip-adapter/generate", summary="IP-Adapter face-consistent generation")
async def ip_adapter_generate(req: IPAdapterRequest, request: Request):
    """
    Generate image with face consistency using IP-Adapter.
    Reference image face is preserved, prompt describes new scene/outfit/context.
    """
    auth_key = request.headers.get("X-API-Key", "")
    expected_key = os.environ.get("GPU_API_KEY", "")
    if not expected_key or auth_key != expected_key:
        raise HTTPException(status_code=401, detail="Invalid API key")

    try:
        logger.info(f"[IP-Adapter] Starting generation: prompt={req.prompt[:60]}... model={req.base_model}")
        
        # Download reference image
        logger.info("[IP-Adapter] Downloading reference image...")
        reference_image = await _download_image(req.reference_image_url)
        reference_image = reference_image.resize((512, 512))  # Normalize for IP-Adapter
        
        # Get model type
        model_type = get_model_type(req.base_model)
        logger.info(f"[IP-Adapter] Model type: {model_type}")
        
        # Import model_loader to get the pipeline
        from core.model_loader import load_model
        pipeline = load_model(req.base_model)
        if pipeline is None:
            raise HTTPException(status_code=500, detail=f"Failed to load model: {req.base_model}")
        
        # Check if IP-Adapter weights exist
        weight_file = SD15_WEIGHT if model_type == "sd15" else SDXL_WEIGHT
        if not os.path.exists(weight_file):
            logger.error(f"[IP-Adapter] Weight file missing: {weight_file}")
            raise HTTPException(status_code=503, detail="IP-Adapter weights not available yet. Downloading...")
        
        # Load IP-Adapter
        logger.info(f"[IP-Adapter] Loading weights from {weight_file}...")
        try:
            pipeline.load_ip_adapter(weight_file, subfolder=None)
            pipeline.set_ip_adapter_scale(req.ip_adapter_scale)
        except Exception as e:
            logger.error(f"[IP-Adapter] Failed to load weights: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to load IP-Adapter: {str(e)}")
        
        # Generate image with reference face
        logger.info(f"[IP-Adapter] Generating with face influence={req.ip_adapter_scale}...")
        
        def generate():
            result = pipeline(
                prompt=req.prompt,
                negative_prompt=req.negative_prompt or "",
                num_inference_steps=req.steps,
                guidance_scale=req.cfg,
                width=req.width,
                height=req.height,
                ip_adapter_image=reference_image,
            ).images[0]
            return result
        
        # Run generation in thread pool
        loop = asyncio.get_event_loop()
        image = await loop.run_in_executor(None, generate)
        
        # Unload IP-Adapter to free VRAM
        try:
            pipeline.unload_ip_adapter()
        except:
            pass
        
        # Save to CDN
        logger.info("[IP-Adapter] Uploading to CDN...")
        buf = io.BytesIO()
        image.save(buf, format="PNG", quality=95)
        image_url = await _upload_to_cdn(buf.getvalue(), "gallery/ip-adapter")
        
        logger.info(f"[IP-Adapter] Complete: {image_url}")
        return {
            "imageUrl": image_url,
            "model": req.base_model,
            "steps": req.steps,
            "cfg": req.cfg,
            "ip_adapter_scale": req.ip_adapter_scale,
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[IP-Adapter] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)[:100])
