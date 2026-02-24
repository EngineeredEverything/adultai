import torch
import gc
import logging
import json
import time
import subprocess
import platform
from typing import Dict, Tuple, Optional, List
from datetime import datetime

logger = logging.getLogger(__name__)

class EnhancedGPUMonitor:
    def __init__(self):
        self.min_free_memory = 1.0  # GB
        self.safety_factor = 0.7
        self.monitoring_history = []
        
    def get_nvidia_smi_data(self) -> Optional[Dict]:
        """Get detailed GPU data from nvidia-smi"""
        try:
            # Query nvidia-smi for comprehensive GPU data
            cmd = [
                'nvidia-smi', 
                '--query-gpu=name,driver_version,temperature.gpu,utilization.gpu,utilization.memory,memory.total,memory.used,memory.free,power.draw,power.limit,clocks.current.graphics,clocks.current.memory,fan.speed',
                '--format=csv,noheader,nounits'
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                lines = result.stdout.strip().split('\n')
                gpu_data = []
                
                for i, line in enumerate(lines):
                    if line.strip():
                        values = [v.strip() for v in line.split(',')]
                        if len(values) >= 13:
                            gpu_data.append({
                                'gpu_id': i,
                                'name': values[0],
                                'driver_version': values[1],
                                'temperature': float(values[2]) if values[2] != '[Not Supported]' else None,
                                'utilization_gpu': float(values[3]) if values[3] != '[Not Supported]' else None,
                                'utilization_memory': float(values[4]) if values[4] != '[Not Supported]' else None,
                                'memory_total_mb': float(values[5]) if values[5] != '[Not Supported]' else None,
                                'memory_used_mb': float(values[6]) if values[6] != '[Not Supported]' else None,
                                'memory_free_mb': float(values[7]) if values[7] != '[Not Supported]' else None,
                                'power_draw_w': float(values[8]) if values[8] != '[Not Supported]' else None,
                                'power_limit_w': float(values[9]) if values[9] != '[Not Supported]' else None,
                                'clock_graphics_mhz': float(values[10]) if values[10] != '[Not Supported]' else None,
                                'clock_memory_mhz': float(values[11]) if values[11] != '[Not Supported]' else None,
                                'fan_speed': float(values[12]) if values[12] != '[Not Supported]' else None,
                            })
                
                return {'gpus': gpu_data, 'timestamp': datetime.now().isoformat()}
                
        except Exception as e:
            logger.error(f"Error getting nvidia-smi data: {e}")
            
        return None
    
    def get_gpu_processes(self) -> Optional[List[Dict]]:
        """Get running processes on GPU"""
        try:
            cmd = ['nvidia-smi', '--query-compute-apps=pid,process_name,gpu_uuid,used_memory', '--format=csv,noheader,nounits']
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                processes = []
                lines = result.stdout.strip().split('\n')
                
                for line in lines:
                    if line.strip():
                        values = [v.strip() for v in line.split(',')]
                        if len(values) >= 4:
                            processes.append({
                                'pid': values[0],
                                'process_name': values[1],
                                'gpu_uuid': values[2],
                                'used_memory_mb': float(values[3]) if values[3] != '[Not Supported]' else None
                            })
                
                return processes
                
        except Exception as e:
            logger.error(f"Error getting GPU processes: {e}")
            
        return None
    
    def get_pytorch_gpu_info(self) -> Optional[Dict]:
        """Get PyTorch-specific GPU information"""
        try:
            if not torch.cuda.is_available():
                return None
                
            gpu_info = []
            for i in range(torch.cuda.device_count()):
                props = torch.cuda.get_device_properties(i)
                
                # Get memory info
                total_memory = props.total_memory
                allocated_memory = torch.cuda.memory_allocated(i)
                cached_memory = torch.cuda.memory_reserved(i)
                free_memory = total_memory - allocated_memory
                
                gpu_info.append({
                    'device_id': i,
                    'name': props.name,
                    'compute_capability': f"{props.major}.{props.minor}",
                    'total_memory_gb': total_memory / (1024**3),
                    'allocated_memory_gb': allocated_memory / (1024**3),
                    'cached_memory_gb': cached_memory / (1024**3),
                    'free_memory_gb': free_memory / (1024**3),
                    'utilization_percent': (allocated_memory / total_memory) * 100,
                    'multiprocessor_count': props.multi_processor_count,
                    'max_threads_per_multiprocessor': props.max_threads_per_multiprocessor,
                    'max_threads_per_block': props.max_threads_per_block,
                    'warp_size': props.warp_size
                })
            
            return {
                'pytorch_version': torch.__version__,
                'cuda_version': torch.version.cuda,
                'cudnn_version': torch.backends.cudnn.version(),
                'gpus': gpu_info,
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting PyTorch GPU info: {e}")
            return None
    
    def get_comprehensive_gpu_data(self) -> Dict:
        """Get all available GPU data"""
        try:
            # Get system info
            system_info = {
                'os': platform.system(),
                'os_version': platform.release(),
                'cpu_model': platform.processor() or platform.machine(),
                'python_version': platform.python_version(),
                'timestamp': datetime.now().isoformat()
            }
            
            # Get nvidia-smi data
            nvidia_data = self.get_nvidia_smi_data()
            
            # Get PyTorch data
            pytorch_data = self.get_pytorch_gpu_info()
            
            # Get GPU processes
            gpu_processes = self.get_gpu_processes()
            
            # Combine all data
            comprehensive_data = {
                'status': 'success',
                'system_info': system_info,
                'nvidia_smi': nvidia_data,
                'pytorch': pytorch_data,
                'gpu_processes': gpu_processes,
                'monitoring_timestamp': datetime.now().isoformat()
            }
            
            # Add to history for trending
            self.monitoring_history.append(comprehensive_data)
            
            # Keep only last 100 entries
            if len(self.monitoring_history) > 100:
                self.monitoring_history = self.monitoring_history[-100:]
            
            return comprehensive_data
            
        except Exception as e:
            logger.error(f"Error getting comprehensive GPU data: {e}")
            return {
                'status': 'error',
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
    
    def get_monitoring_history(self) -> List[Dict]:
        """Get historical monitoring data for trending"""
        return self.monitoring_history
    
    def clear_memory(self) -> bool:
        """Enhanced memory cleanup"""
        try:
            logger.debug("Starting enhanced memory cleanup...")
            
            # Force garbage collection
            gc.collect()
            
            # Clear CUDA cache if available
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                torch.cuda.synchronize()
                
                # Clear memory for all devices
                for i in range(torch.cuda.device_count()):
                    with torch.cuda.device(i):
                        torch.cuda.empty_cache()
            
            logger.debug("Enhanced memory cleanup completed")
            return True
            
        except Exception as e:
            logger.error(f"Error during enhanced memory cleanup: {e}")
            return False
