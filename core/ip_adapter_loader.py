"""
IP-Adapter face model loader for diffusers.
Handles model type detection (SD1.5 vs SDXL) and weight loading.
"""
import os
import logging
from typing import Optional
from diffusers import StableDiffusionPipeline, StableDiffusionXLPipeline

logger = logging.getLogger(__name__)

# Model type mapping
SD15_MODELS = {"urpm", "dreamshaper"}
SDXL_MODELS = {"cyberrealistic_pony", "pony_realism", "damn_pony", "lustify", "pony_diffusion"}

# Weight file paths
WEIGHTS_DIR = "/root/urpm/models/ip_adapter"
SD15_WEIGHT = os.path.join(WEIGHTS_DIR, "ip-adapter-plus-face_sd15.bin")
SDXL_WEIGHT = os.path.join(WEIGHTS_DIR, "ip-adapter-plus-face_sdxl_vit-h.safetensors")
IMAGE_ENCODER_CONFIG = os.path.join(WEIGHTS_DIR, "image_encoder", "config.json")
IMAGE_ENCODER_WEIGHT = os.path.join(WEIGHTS_DIR, "image_encoder", "pytorch_model.bin")

def get_model_type(model_name: str) -> str:
    """Determine if model is SD1.5 or SDXL."""
    if model_name in SD15_MODELS:
        return "sd15"
    elif model_name in SDXL_MODELS:
        return "sdxl"
    else:
        return "sdxl"  # Default to SDXL

def load_ip_adapter(pipeline, model_type: str, scale: float = 0.6) -> bool:
    """
    Load IP-Adapter weights into the pipeline.
    
    Args:
        pipeline: The diffusers pipeline (SD or SDXL)
        model_type: "sd15" or "sdxl"
        scale: IP-Adapter scale (0.3-1.0)
    
    Returns:
        True if loaded successfully, False otherwise
    """
    try:
        if model_type == "sd15":
            weight_file = SD15_WEIGHT
        else:
            weight_file = SDXL_WEIGHT
        
        if not os.path.exists(weight_file):
            logger.warning(f"[IP-Adapter] Weight file not found: {weight_file}")
            return False
        
        # Load IP-Adapter
        pipeline.load_ip_adapter(weight_file, subfolder=None)
        pipeline.set_ip_adapter_scale(scale)
        logger.info(f"[IP-Adapter] Loaded {model_type} weights, scale={scale}")
        return True
    except Exception as e:
        logger.error(f"[IP-Adapter] Failed to load: {e}")
        return False

def unload_ip_adapter(pipeline) -> None:
    """Unload IP-Adapter from pipeline."""
    try:
        if hasattr(pipeline, "unload_ip_adapter"):
            pipeline.unload_ip_adapter()
        logger.info("[IP-Adapter] Unloaded")
    except Exception as e:
        logger.warning(f"[IP-Adapter] Failed to unload: {e}")
