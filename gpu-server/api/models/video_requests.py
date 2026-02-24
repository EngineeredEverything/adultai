from pydantic import BaseModel, Field, ConfigDict
from typing import Optional


class VideoRequest(BaseModel):
    """Text-to-Video generation request for Wan-AI model"""

    model_config = ConfigDict(
        protected_namespaces=(),  # Disable protected namespace warning
        json_schema_extra={
            "example": {
                "prompt": "A cat walking on the beach at sunset",
                "negative_prompt": "blurry, low quality, distorted",
                "num_inference_steps": 50,
                "guidance_scale": 7.5,
                "width": 848,
                "height": 480,
                "num_frames": 81,
                "fps": 24,
                "seed": 42,
            }
        },
    )

    prompt: str = Field(..., description="Text description of the video to generate")
    negative_prompt: Optional[str] = Field(
        default="", description="What to avoid in the video"
    )
    num_inference_steps: int = Field(
        default=50, ge=1, le=100, description="Number of denoising steps"
    )
    guidance_scale: float = Field(
        default=7.5, ge=1.0, le=20.0, description="Guidance scale for generation"
    )
    width: int = Field(
        default=848, ge=64, le=1920, description="Video width (must be divisible by 8)"
    )
    height: int = Field(
        default=480, ge=64, le=1080, description="Video height (must be divisible by 8)"
    )
    num_frames: int = Field(
        default=81, ge=1, le=81, description="Number of frames to generate"
    )
    fps: int = Field(default=24, ge=1, le=60, description="Frames per second")
    seed: Optional[int] = Field(
        default=None, description="Random seed for reproducibility"
    )
    webhook: Optional[str] = Field(
        default=None, description="Webhook URL for completion notification"
    )
    track_id: Optional[str] = Field(default=None, description="Custom tracking ID")


class ImageToVideoRequest(BaseModel):
    """Image-to-Video generation request"""

    model_config = ConfigDict(
        protected_namespaces=(),
        json_schema_extra={
            "example": {
                "image": "data:image/png;base64,iVBORw0KG...",
                "num_frames": 81,
                "fps": 24,
                "seed": 42,
            }
        },
    )

    image: str = Field(..., description="Base64 encoded input image")
    num_frames: int = Field(
        default=81, ge=1, le=81, description="Number of frames to generate"
    )
    fps: int = Field(default=24, ge=1, le=60, description="Frames per second")
    motion_bucket_id: int = Field(
        default=127, ge=1, le=255, description="Motion strength (for SVD models)"
    )
    noise_aug_strength: float = Field(
        default=0.02, ge=0.0, le=1.0, description="Noise augmentation strength"
    )
    seed: Optional[int] = Field(
        default=None, description="Random seed for reproducibility"
    )
    webhook: Optional[str] = Field(
        default=None, description="Webhook URL for completion notification"
    )
    track_id: Optional[str] = Field(default=None, description="Custom tracking ID")
