import torch
import gc
import logging
from typing import Dict, Tuple, Optional
from core.config import settings

logger = logging.getLogger(__name__)

class MemoryManager:
    def __init__(self):
        self.min_free_memory = settings.MIN_FREE_MEMORY_GB
        self.safety_factor = settings.MEMORY_SAFETY_FACTOR
    
    def get_gpu_memory_info(self) -> Optional[Dict[str, float]]:
        """Get detailed GPU memory information"""
        try:
            if not torch.cuda.is_available():
                return None
                
            total_memory = torch.cuda.get_device_properties(0).total_memory
            allocated_memory = torch.cuda.memory_allocated(0)
            cached_memory = torch.cuda.memory_reserved(0)
            free_memory = total_memory - allocated_memory
            
            return {
                'total_gb': total_memory / (1024**3),
                'allocated_gb': allocated_memory / (1024**3),
                'cached_gb': cached_memory / (1024**3),
                'free_gb': free_memory / (1024**3),
                'utilization_percent': (allocated_memory / total_memory) * 100
            }
        except Exception as e:
            logger.error(f"Error getting GPU memory info: {e}")
            return None
    
    def clear_memory(self) -> bool:
        """Comprehensive memory cleanup"""
        try:
            logger.debug("Starting memory cleanup...")
            
            # Force garbage collection
            gc.collect()
            
            # Clear CUDA cache if available
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                torch.cuda.synchronize()
                
                # Get memory info after cleanup
                memory_info = self.get_gpu_memory_info()
                if memory_info:
                    logger.debug(f"Memory after cleanup: {memory_info['free_gb']:.2f}GB free")
            
            logger.debug("Memory cleanup completed successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error during memory cleanup: {e}")
            return False
    
    def estimate_memory_requirement(self, height: int, width: int, samples: int, steps: int) -> float:
        """Estimate memory requirement for generation"""
        try:
            # Base memory per pixel (empirically determined for float16)
            base_memory_per_pixel = 0.000001  # GB per pixel
            
            # Memory scales with resolution and number of samples
            pixel_count = height * width
            base_memory = pixel_count * base_memory_per_pixel * samples
            
            # Additional memory for intermediate steps (UNet, VAE, etc.)
            step_memory = base_memory * 0.5 * (steps / 50)  # Normalized to 50 steps
            
            # Safety buffer for model weights and intermediate tensors
            total_memory = (base_memory + step_memory) * 2.5
            
            return total_memory
            
        except Exception as e:
            logger.error(f"Error estimating memory requirement: {e}")
            return float('inf')  # Return high value to prevent generation
    
    def can_generate(self, height: int, width: int, samples: int, steps: int) -> Tuple[bool, int]:
        """Check if generation is possible and return max possible samples"""
        try:
            memory_info = self.get_gpu_memory_info()
            if not memory_info:
                logger.warning("Cannot get GPU memory info, allowing generation with reduced samples")
                return True, min(samples, 1)
            
            required_memory = self.estimate_memory_requirement(height, width, samples, steps)
            available_memory = memory_info['free_gb'] * self.safety_factor
            
            logger.debug(f"Memory check - Required: {required_memory:.2f}GB, Available: {available_memory:.2f}GB")
            
            # Check if we have enough memory
            if required_memory <= available_memory:
                return True, samples
            
            # Calculate maximum possible samples
            if samples > 1:
                memory_per_sample = required_memory / samples
                max_samples = max(1, int(available_memory / memory_per_sample))
                return False, min(max_samples, samples)
            
            # If even 1 sample doesn't fit, check if we're close
            if available_memory > self.min_free_memory:
                logger.warning("Attempting generation with minimal memory")
                return True, 1
            
            return False, 0
            
        except Exception as e:
            logger.error(f"Error checking memory availability: {e}")
            return True, min(samples, 1)  # Conservative fallback
    
    def is_memory_critical(self) -> bool:
        """Check if memory usage is critically high"""
        try:
            memory_info = self.get_gpu_memory_info()
            if not memory_info:
                return False
            
            return memory_info['free_gb'] < self.min_free_memory
            
        except Exception as e:
            logger.error(f"Error checking critical memory: {e}")
            return False
    
    def get_memory_stats(self) -> Dict[str, any]:
        """Get comprehensive memory statistics"""
        try:
            memory_info = self.get_gpu_memory_info()
            if not memory_info:
                return {"status": "unavailable"}
            
            is_critical = self.is_memory_critical()
            
            return {
                "status": "critical" if is_critical else "normal",
                "total_gb": memory_info['total_gb'],
                "allocated_gb": memory_info['allocated_gb'],
                "cached_gb": memory_info['cached_gb'],
                "free_gb": memory_info['free_gb'],
                "utilization_percent": memory_info['utilization_percent'],
                "safety_threshold_gb": memory_info['total_gb'] * self.safety_factor,
                "min_free_threshold_gb": self.min_free_memory
            }
            
        except Exception as e:
            logger.error(f"Error getting memory stats: {e}")
            return {"status": "error", "error": str(e)}
