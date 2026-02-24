"""
Integration helpers — wraps existing routes with broker lease management.

Import these in main.py to patch generation, img2img, upscale, and talking_avatar
routes to acquire/release GPU leases through the broker.
"""

import logging
import functools
from typing import Callable
from fastapi import HTTPException

from gpu_resource_broker import get_broker, GPUWorkload

logger = logging.getLogger(__name__)


def with_gpu_lease(workload: GPUWorkload, description: str = "", timeout: float = 30.0):
    """
    Decorator for FastAPI async route handlers.
    Acquires a GPU lease before running the handler, releases after.

    Usage:
        @router.post("/generate")
        @with_gpu_lease(GPUWorkload.IMAGE_GEN, "txt2img generation")
        async def generate_image(request: ImageRequest, req: Request):
            ...
    """

    def decorator(func: Callable):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            broker = get_broker()
            lease = await broker.acquire(workload, description, timeout)

            if lease is None:
                raise HTTPException(
                    status_code=503,
                    detail=f"GPU busy — {workload.name} request queued too long. Try again shortly.",
                )

            try:
                return await func(*args, **kwargs)
            finally:
                await broker.release(lease.lease_id)

        return wrapper

    return decorator


# ── Pre-built decorators for common workloads ──────────────────────────────

image_gen_lease = with_gpu_lease(
    GPUWorkload.IMAGE_GEN,
    "image generation",
    timeout=60.0,  # Image gen can wait longer since it's highest priority
)

img2img_lease = with_gpu_lease(
    GPUWorkload.IMG2IMG,
    "img2img / inpaint",
    timeout=45.0,
)

upscale_lease = with_gpu_lease(
    GPUWorkload.UPSCALE,
    "upscale",
    timeout=30.0,
)

talking_avatar_lease = with_gpu_lease(
    GPUWorkload.TALKING_AVATAR,
    "wav2lip talking avatar",
    timeout=30.0,
)
