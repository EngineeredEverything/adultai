import torch
from diffusers import WanPipeline, AutoencoderKLWan, WanTransformer3DModel, UniPCMultistepScheduler
import logging
import traceback
import psutil
from contextlib import contextmanager
from core.config import settings

logger = logging.getLogger(__name__)

# Configure detailed logging
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s",
)


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
        else:
            logger.warning(f"[GPU_MEM][{context}] CUDA not available")
    except Exception as e:
        logger.error(f"[GPU_MEM][{context}] Error logging GPU memory: {e}")


def log_system_memory(context: str):
    """Log system RAM usage"""
    try:
        memory = psutil.virtual_memory()
        logger.info(
            f"[SYS_MEM][{context}] Used: {memory.used / 1024**3:.2f}GB, Available: {memory.available / 1024**3:.2f}GB, Total: {memory.total / 1024**3:.2f}GB ({memory.percent}%)"
        )
    except Exception as e:
        logger.error(f"[SYS_MEM][{context}] Error logging system memory: {e}")


class VideoModelLoader:
    def __init__(self):
        logger.info("[VIDEO_LOADER] Initializing VideoModelLoader")
        self.pipe = None
        self.model_loaded = False
        self.model_path = settings.VIDEO_MODEL_PATH
        logger.info(f"[VIDEO_LOADER] Model path: {self.model_path}")
        log_gpu_memory("init")
        log_system_memory("init")

    async def load_model(self):
        """Load the video generation model with optimizations and extensive debugging"""
        logger.info("[VIDEO_LOADER] ========== STARTING MODEL LOAD ==========")
        log_gpu_memory("before_load")
        log_system_memory("before_load")

        try:
            logger.info(
                f"[VIDEO_LOADER] Loading video generation model from {self.model_path}..."
            )

            # Check if CUDA is available
            if not torch.cuda.is_available():
                raise RuntimeError(
                    "CUDA is not available! GPU is required for video generation."
                )

            logger.info(f"[VIDEO_LOADER] CUDA device: {torch.cuda.get_device_name(0)}")
            logger.info(f"[VIDEO_LOADER] CUDA version: {torch.version.cuda}")

            # Load video model with memory optimizations
            logger.info("[VIDEO_LOADER] Starting DiffusionPipeline.from_pretrained...")
            load_start = torch.cuda.Event(enable_timing=True)
            load_end = torch.cuda.Event(enable_timing=True)

            load_start.record()

            try:
                logger.info(
                    "[VIDEO_LOADER] Loading Wan-AI video model with trust_remote_code=True and size mismatch handling..."
                )
                # dtype = torch.bfloat16
                # model_id = "Wan-AI/Wan2.2-TI2V-5B-Diffusers"
                # vae = AutoencoderKLWan.from_pretrained(model_id, subfolder="vae", torch_dtype=torch.float32)
                # self.pipe = WanPipeline.from_pretrained(model_id, vae=vae, torch_dtype=dtype)


                # self.pipe = DiffusionPipeline.from_pretrained("Wan-AI/Wan2.2-TI2V-5B-Diffusers")

                # Load with fp16 and allow size mismatches for Wan-AI model
                # Note: low_cpu_mem_usage defaults to True, which is compatible with keep_in_fp32_modules
                # self.pipe = DiffusionPipeline.from_pretrained(
                #     self.model_path,
                #     torch_dtype=torch.float16,  # Use fp16 from the start
                #     trust_remote_code=True,  # CRITICAL: Load custom Wan pipeline classes
                #     use_safetensors=True,  # Use safetensors format
                #     ignore_mismatched_sizes=True,  # Allow loading with size mismatches
                # )
                logger.info(
                    "[VIDEO_LOADER] Pipeline loaded successfully with size mismatch handling"
                )

            except Exception as e:
                logger.error(
                    f"[VIDEO_LOADER] Error loading model with size mismatch handling: {e}"
                )
                logger.error(f"[VIDEO_LOADER] Traceback:\n{traceback.format_exc()}")
                raise

            log_gpu_memory("after_from_pretrained")
            log_system_memory("after_from_pretrained")

            # Move to CUDA
            logger.info("[VIDEO_LOADER] Moving model to CUDA...")
            try:
                self.pipe = self.pipe.to("cuda")
                logger.info("[VIDEO_LOADER] Model moved to CUDA successfully")
            except Exception as cuda_error:
                logger.error(f"[VIDEO_LOADER] Failed to move to CUDA: {cuda_error}")
                logger.error(f"[VIDEO_LOADER] Traceback:\n{traceback.format_exc()}")
                raise

            load_end.record()
            torch.cuda.synchronize()
            load_time = load_start.elapsed_time(load_end) / 1000.0  # Convert to seconds
            logger.info(f"[VIDEO_LOADER] Model loading took {load_time:.2f} seconds")

            log_gpu_memory("after_to_cuda")
            log_system_memory("after_to_cuda")

            # Enable all available memory optimizations
            logger.info("[VIDEO_LOADER] Enabling memory optimizations...")

            try:
                logger.debug("[VIDEO_LOADER] Enabling attention slicing...")
                self.pipe.enable_attention_slicing()
                logger.info("[VIDEO_LOADER] ✓ Attention slicing enabled")
            except Exception as e:
                logger.warning(f"[VIDEO_LOADER] Could not enable attention slicing: {e}")

            try:
                if hasattr(self.pipe, 'enable_vae_slicing'):
                    logger.debug("[VIDEO_LOADER] Enabling VAE slicing...")
                    self.pipe.enable_vae_slicing()
                    logger.info("[VIDEO_LOADER] ✓ VAE slicing enabled")
            except Exception as e:
                logger.warning(f"[VIDEO_LOADER] Could not enable VAE slicing: {e}")

            try:
                if hasattr(self.pipe, 'enable_vae_tiling'):
                    logger.debug("[VIDEO_LOADER] Enabling VAE tiling...")
                    self.pipe.enable_vae_tiling()
                    logger.info("[VIDEO_LOADER] ✓ VAE tiling enabled")
            except Exception as e:
                logger.warning(f"[VIDEO_LOADER] Could not enable VAE tiling: {e}")

            log_gpu_memory("after_optimizations")
            log_system_memory("after_optimizations")

            # Log pipeline components
            logger.info("[VIDEO_LOADER] Pipeline components:")
            logger.info(f"  - Pipeline type: {type(self.pipe).__name__}")
            for component_name in ['vae', 'unet', 'text_encoder', 'scheduler', 'tokenizer']:
                if hasattr(self.pipe, component_name):
                    component = getattr(self.pipe, component_name, None)
                    if component is not None:
                        logger.info(f"  - {component_name}: {type(component).__name__}")

            self.model_loaded = True
            logger.info(
                "[VIDEO_LOADER] ========== MODEL LOADED SUCCESSFULLY =========="
            )
            log_gpu_memory("load_complete")
            log_system_memory("load_complete")

        except Exception as e:
            logger.error(f"[VIDEO_LOADER] ========== MODEL LOAD FAILED ==========")
            logger.error(f"[VIDEO_LOADER] Error: {e}")
            logger.error(f"[VIDEO_LOADER] Full traceback:\n{traceback.format_exc()}")
            log_gpu_memory("load_failed")
            log_system_memory("load_failed")
            self.model_loaded = False
            raise

    def get_pipeline(self):
        """Get the loaded pipeline"""
        logger.debug("[VIDEO_LOADER] get_pipeline() called")
        if not self.model_loaded or self.pipe is None:
            logger.error("[VIDEO_LOADER] Model not loaded when get_pipeline() called!")
            raise RuntimeError("Video model not loaded. Call load_model() first.")
        logger.debug("[VIDEO_LOADER] Returning pipeline")
        return self.pipe

    def is_loaded(self) -> bool:
        """Check if model is loaded"""
        loaded = self.model_loaded and self.pipe is not None
        logger.debug(f"[VIDEO_LOADER] is_loaded() called, returning: {loaded}")
        return loaded

    @contextmanager
    def memory_managed_generation(self):
        """Context manager for memory-safe video generation with extensive debugging"""
        logger.info(
            "[VIDEO_LOADER] ========== ENTERING MEMORY MANAGED CONTEXT =========="
        )
        log_gpu_memory("context_enter")
        log_system_memory("context_enter")

        memory_manager = None

        try:
            logger.debug("[VIDEO_LOADER] Importing MemoryManager...")
            from core.memory_manager import MemoryManager

            memory_manager = MemoryManager()
            logger.debug("[VIDEO_LOADER] MemoryManager imported and instantiated")

            # Clear memory before generation
            logger.info("[VIDEO_LOADER] Clearing memory before generation...")
            try:
                memory_manager.clear_memory()
                logger.info("[VIDEO_LOADER] Memory cleared successfully")
            except Exception as clear_error:
                logger.error(f"[VIDEO_LOADER] Error clearing memory: {clear_error}")
                logger.error(f"[VIDEO_LOADER] Traceback:\n{traceback.format_exc()}")

            log_gpu_memory("after_clear")
            log_system_memory("after_clear")

            logger.info("[VIDEO_LOADER] Yielding pipeline to caller...")
            yield self.get_pipeline()
            logger.info("[VIDEO_LOADER] Pipeline returned from caller")

        except Exception as e:
            logger.error(
                f"[VIDEO_LOADER] Error in memory_managed_generation context: {e}"
            )
            logger.error(f"[VIDEO_LOADER] Traceback:\n{traceback.format_exc()}")
            log_gpu_memory("context_error")
            log_system_memory("context_error")
            raise

        finally:
            logger.info(
                "[VIDEO_LOADER] ========== EXITING MEMORY MANAGED CONTEXT =========="
            )
            log_gpu_memory("context_exit_before_clear")
            log_system_memory("context_exit_before_clear")

            # Always clear memory after generation
            if memory_manager is not None:
                logger.info("[VIDEO_LOADER] Clearing memory in finally block...")
                try:
                    memory_manager.clear_memory()
                    logger.info("[VIDEO_LOADER] Memory cleared in finally block")
                except Exception as final_clear_error:
                    logger.error(
                        f"[VIDEO_LOADER] Error clearing memory in finally: {final_clear_error}"
                    )
                    logger.error(f"[VIDEO_LOADER] Traceback:\n{traceback.format_exc()}")
            else:
                logger.warning(
                    "[VIDEO_LOADER] memory_manager is None, cannot clear memory"
                )

            log_gpu_memory("context_exit_after_clear")
            log_system_memory("context_exit_after_clear")
            logger.info("[VIDEO_LOADER] Context manager cleanup complete")

    def unload_model(self):
        """Unload the model and free memory"""
        logger.info("[VIDEO_LOADER] ========== UNLOADING MODEL ==========")
        log_gpu_memory("before_unload")
        log_system_memory("before_unload")

        try:
            if self.pipe is not None:
                logger.debug("[VIDEO_LOADER] Deleting pipeline...")
                del self.pipe
                self.pipe = None
                logger.info("[VIDEO_LOADER] Pipeline deleted")

            self.model_loaded = False

            # Clear CUDA cache
            if torch.cuda.is_available():
                logger.debug("[VIDEO_LOADER] Clearing CUDA cache...")
                torch.cuda.empty_cache()
                torch.cuda.synchronize()
                logger.info("[VIDEO_LOADER] CUDA cache cleared")

            log_gpu_memory("after_unload")
            log_system_memory("after_unload")
            logger.info("[VIDEO_LOADER] ========== MODEL UNLOADED ==========")

        except Exception as e:
            logger.error(f"[VIDEO_LOADER] Error unloading model: {e}")
            logger.error(f"[VIDEO_LOADER] Traceback:\n{traceback.format_exc()}")

    def get_model_info(self):
        """Get information about the loaded model"""
        info = {
            "loaded": self.model_loaded,
            "model_path": self.model_path,
            "cuda_available": torch.cuda.is_available(),
        }

        if torch.cuda.is_available():
            info["cuda_device"] = torch.cuda.get_device_name(0)
            info["cuda_version"] = torch.version.cuda
            info["gpu_memory_allocated_gb"] = torch.cuda.memory_allocated() / 1024**3
            info["gpu_memory_reserved_gb"] = torch.cuda.memory_reserved() / 1024**3
            info["gpu_memory_total_gb"] = (
                torch.cuda.get_device_properties(0).total_memory / 1024**3
            )

        if self.pipe is not None:
            info["pipeline_type"] = type(self.pipe).__name__
            info["pipeline_device"] = (
                str(self.pipe.device) if hasattr(self.pipe, "device") else "unknown"
            )

        logger.info(f"[VIDEO_LOADER] Model info: {info}")
        return info
