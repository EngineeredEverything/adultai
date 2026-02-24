import torch
from diffusers import CogVideoXPipeline
import logging
import traceback
import psutil
from contextlib import contextmanager
from core.config import settings

logger = logging.getLogger(__name__)


def log_gpu_memory(context: str):
    """Log GPU memory usage"""
    try:
        if torch.cuda.is_available():
            allocated = torch.cuda.memory_allocated() / 1024**3
            reserved = torch.cuda.memory_reserved() / 1024**3
            total = torch.cuda.get_device_properties(0).total_memory / 1024**3
            free = total - allocated
            logger.info(
                f"[GPU_MEM][{context}] Allocated: {allocated:.2f}GB, Reserved: {reserved:.2f}GB, Free: {free:.2f}GB, Total: {total:.2f}GB"
            )
    except Exception as e:
        logger.error(f"[GPU_MEM][{context}] Error: {e}")


def log_system_memory(context: str):
    """Log system RAM usage"""
    try:
        memory = psutil.virtual_memory()
        logger.info(
            f"[SYS_MEM][{context}] Used: {memory.used / 1024**3:.2f}GB, Available: {memory.available / 1024**3:.2f}GB, Total: {memory.total / 1024**3:.2f}GB ({memory.percent}%)"
        )
    except Exception as e:
        logger.error(f"[SYS_MEM][{context}] Error: {e}")


class VideoModelLoader:
    def __init__(self):
        logger.info("[VIDEO_LOADER] Initializing VideoModelLoader (CogVideoX-2B)")
        self.pipe = None
        self.model_loaded = False
        self.model_path = settings.VIDEO_MODEL_PATH
        logger.info(f"[VIDEO_LOADER] Model path: {self.model_path}")

    async def load_model(self):
        """Load CogVideoX-2B with fp16 and memory optimizations"""
        logger.info("[VIDEO_LOADER] ========== LOADING CogVideoX-2B ==========")
        log_gpu_memory("before_load")
        log_system_memory("before_load")

        try:
            if not torch.cuda.is_available():
                raise RuntimeError("CUDA not available")

            logger.info(f"[VIDEO_LOADER] GPU: {torch.cuda.get_device_name(0)}")
            logger.info(f"[VIDEO_LOADER] Loading from {self.model_path}...")

            # Load CogVideoX-2B in fp16 for RTX 3090
            self.pipe = CogVideoXPipeline.from_pretrained(
                self.model_path,
                torch_dtype=torch.float16,
            )

            log_gpu_memory("after_from_pretrained")
            log_system_memory("after_from_pretrained")

            # Enable memory optimizations BEFORE moving to GPU
            logger.info("[VIDEO_LOADER] Enabling memory optimizations...")

            # Use model CPU offload to keep VRAM usage low
            # This moves each component to GPU only when needed
            self.pipe.enable_model_cpu_offload()
            logger.info("[VIDEO_LOADER] CPU offload enabled")

            # VAE optimizations
            try:
                self.pipe.enable_vae_slicing()
                logger.info("[VIDEO_LOADER] VAE slicing enabled")
            except Exception as e:
                logger.warning(f"[VIDEO_LOADER] VAE slicing not available: {e}")

            try:
                self.pipe.enable_vae_tiling()
                logger.info("[VIDEO_LOADER] VAE tiling enabled")
            except Exception as e:
                logger.warning(f"[VIDEO_LOADER] VAE tiling not available: {e}")

            log_gpu_memory("after_optimizations")
            log_system_memory("after_optimizations")

            # Log pipeline info
            logger.info(f"[VIDEO_LOADER] Pipeline type: {type(self.pipe).__name__}")
            for name in ['vae', 'transformer', 'text_encoder', 'scheduler', 'tokenizer']:
                if hasattr(self.pipe, name):
                    comp = getattr(self.pipe, name, None)
                    if comp is not None:
                        logger.info(f"  - {name}: {type(comp).__name__}")

            self.model_loaded = True
            logger.info("[VIDEO_LOADER] ========== CogVideoX-2B LOADED ==========")

        except Exception as e:
            logger.error(f"[VIDEO_LOADER] ========== LOAD FAILED ==========")
            logger.error(f"[VIDEO_LOADER] Error: {e}")
            logger.error(f"[VIDEO_LOADER] Traceback:\n{traceback.format_exc()}")
            log_gpu_memory("load_failed")
            self.model_loaded = False
            raise

    def get_pipeline(self):
        if not self.model_loaded or self.pipe is None:
            raise RuntimeError("Video model not loaded")
        return self.pipe

    def is_loaded(self) -> bool:
        return self.model_loaded and self.pipe is not None

    @contextmanager
    def memory_managed_generation(self):
        """Context manager for memory-safe video generation"""
        logger.info("[VIDEO_LOADER] Entering generation context")
        log_gpu_memory("context_enter")

        try:
            # Clear cache before generation
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

            yield self.get_pipeline()

        except Exception as e:
            logger.error(f"[VIDEO_LOADER] Generation error: {e}")
            raise

        finally:
            # Clear cache after generation
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            log_gpu_memory("context_exit")

    def unload_model(self):
        """Unload model and free memory"""
        logger.info("[VIDEO_LOADER] Unloading model")
        try:
            if self.pipe is not None:
                del self.pipe
                self.pipe = None
            self.model_loaded = False
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                torch.cuda.synchronize()
            logger.info("[VIDEO_LOADER] Model unloaded")
        except Exception as e:
            logger.error(f"[VIDEO_LOADER] Unload error: {e}")

    def get_model_info(self):
        info = {
            "loaded": self.model_loaded,
            "model_path": self.model_path,
            "model_type": "CogVideoX-2B",
            "cuda_available": torch.cuda.is_available(),
        }
        if torch.cuda.is_available():
            info["cuda_device"] = torch.cuda.get_device_name(0)
            info["gpu_memory_allocated_gb"] = torch.cuda.memory_allocated() / 1024**3
            info["gpu_memory_total_gb"] = torch.cuda.get_device_properties(0).total_memory / 1024**3
        if self.pipe is not None:
            info["pipeline_type"] = type(self.pipe).__name__
        return info
