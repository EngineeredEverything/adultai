import torch
from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler, DPMSolverSDEScheduler, EulerAncestralDiscreteScheduler
import logging
from contextlib import contextmanager
from core.config import settings

logger = logging.getLogger(__name__)

SAMPLERS = {
    "dpmpp_2m_karras": lambda cfg: DPMSolverMultistepScheduler.from_config(cfg, use_karras_sigmas=True),
    "dpmpp_sde_karras": lambda cfg: DPMSolverSDEScheduler.from_config(cfg, use_karras_sigmas=True),
    "euler_a": lambda cfg: EulerAncestralDiscreteScheduler.from_config(cfg),
}
DEFAULT_SAMPLER = "dpmpp_2m_karras"

class ModelLoader:
    def __init__(self):
        self.pipe = None
        self.model_loaded = False
        self.model_path = settings.MODEL_PATH
        self._current_sampler = DEFAULT_SAMPLER

    async def load_model(self):
        """Load the Stable Diffusion model with optimizations"""
        try:
            logger.info(f"Loading Stable Diffusion model from {self.model_path}...")

            self.pipe = StableDiffusionPipeline.from_pretrained(
                self.model_path,
                safety_checker=None,
                torch_dtype=torch.float16,
                use_safetensors=False,
                low_cpu_mem_usage=True
            ).to("cuda")

            # Apply default sampler
            self._apply_sampler(DEFAULT_SAMPLER)

            # Memory optimizations
            logger.info("Enabling memory optimizations...")
            self.pipe.enable_attention_slicing()
            self.pipe.enable_vae_slicing()

            if hasattr(self.pipe, "enable_model_cpu_offload"):
                self.pipe.enable_model_cpu_offload()
            elif hasattr(self.pipe, "enable_sequential_cpu_offload"):
                self.pipe.enable_sequential_cpu_offload()

            self.model_loaded = True
            logger.info("Model loaded successfully with memory optimizations")

        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            self.model_loaded = False
            raise

    def _apply_sampler(self, sampler_name: str):
        """Apply a scheduler by name to the loaded pipeline."""
        if self.pipe is None:
            return
        fn = SAMPLERS.get(sampler_name)
        if fn is None:
            logger.warning(f"Unknown sampler {sampler_name}, using {DEFAULT_SAMPLER}")
            fn = SAMPLERS[DEFAULT_SAMPLER]
            sampler_name = DEFAULT_SAMPLER
        self.pipe.scheduler = fn(self.pipe.scheduler.config)
        self._current_sampler = sampler_name
        logger.info(f"Sampler set to: {sampler_name}")

    def set_sampler(self, sampler_name: str):
        """Swap the scheduler at runtime."""
        if sampler_name and sampler_name != self._current_sampler:
            self._apply_sampler(sampler_name)

    def get_pipeline(self):
        if not self.model_loaded or self.pipe is None:
            raise RuntimeError("Model not loaded. Call load_model() first.")
        return self.pipe

    def is_loaded(self) -> bool:
        return self.model_loaded and self.pipe is not None

    @contextmanager
    def memory_managed_generation(self):
        try:
            from core.memory_manager import MemoryManager
            memory_manager = MemoryManager()
            memory_manager.clear_memory()
            yield self.get_pipeline()
        finally:
            memory_manager.clear_memory()
