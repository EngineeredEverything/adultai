from pydantic import BaseModel, Field
from typing import Optional
from core.config import settings

NEGATIVE_BASE = (
    "(worst quality, low quality:1.4), blurry, bad anatomy, extra fingers, extra limbs, "
    "poorly drawn hands, deformed, jpeg artifacts, oversharpened, plastic skin, "
    "watermark, text, logo, cgi, 3d render, cartoon, doll skin, smooth skin"
)

class ImageRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000, description="Text prompt for image generation")
    num_inference_steps: int = Field(42, ge=1, le=settings.MAX_STEPS, description="Number of denoising steps")
    guidance_scale: float = Field(6.8, ge=1.0, le=20.0, description="Guidance scale for generation")
    height: int = Field(768, ge=64, le=settings.MAX_RESOLUTION, description="Image height in pixels")
    width: int = Field(512, ge=64, le=settings.MAX_RESOLUTION, description="Image width in pixels")
    samples: int = Field(1, ge=1, le=settings.MAX_SAMPLES, description="Number of images to generate")
    seed: Optional[int] = Field(None, ge=0, description="Random seed for reproducible results")
    key: Optional[str] = Field(None, description="API key for authentication")
    webhook: Optional[str] = Field(None, description="Webhook URL for async notifications")
    track_id: Optional[str] = Field(None, description="Tracking ID for request correlation")
    model_id: Optional[str] = Field(None, description="Model ID to use")
    lora_model: Optional[str] = Field(None, description="LoRA model to apply")
    lora_strength: Optional[float] = Field(None, ge=0.0, le=2.0, description="LoRA strength")
    enhance_style: Optional[str] = Field(None, description="Style enhancement option")
    negative_prompt: Optional[str] = Field(None, description="Negative prompt - auto-injected if empty")
    sampler: Optional[str] = Field(None, description="Sampler: dpmpp_2m_karras, dpmpp_sde_karras, euler_a")
    # High-res fix parameters
    hires_fix: bool = Field(True, description="Enable high-res fix second pass for better detail")
    hires_scale: float = Field(1.75, ge=1.0, le=4.0, description="Upscale factor for high-res fix")
    hires_denoise: float = Field(0.4, ge=0.1, le=0.99, description="Denoise strength for high-res fix pass")
    hires_steps: int = Field(28, ge=10, le=50, description="Steps for high-res fix second pass")
    # Face restore
    face_restore: bool = Field(True, description="Apply GFPGAN face restoration")
    face_restore_strength: float = Field(0.2, ge=0.0, le=1.0, description="GFPGAN strength (0.15-0.25 for realism)")
    clip_skip: int = Field(1, ge=1, le=12, description="CLIP text encoder layers to skip (1=default, 2=common for anime)")

    class Config:
        schema_extra = {
            "example": {
                "prompt": "beautiful woman, natural skin, soft lighting",
                "num_inference_steps": 42,
                "guidance_scale": 6.8,
                "height": 768,
                "width": 512,
                "samples": 1,
                "hires_fix": True
            }
        }
