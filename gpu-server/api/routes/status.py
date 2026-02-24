import psutil
import subprocess
import platform
import logging
from core.enhanced_gpu_monitor import EnhancedGPUMonitor
from fastapi import APIRouter, Request

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/status")
async def get_status(req: Request):
    """Get comprehensive system status"""
    try:
        memory_manager = req.app.state.memory_manager
        model_loader = req.app.state.model_loader
        monitor = EnhancedGPUMonitor()

        # Get comprehensive data
        gpu_data = monitor.get_comprehensive_gpu_data()

        # GPU Memory
        memory_info = memory_manager.get_memory_stats()

        # GPU memory used via nvidia-smi
        try:
            gpu_used = (
                subprocess.check_output(
                    [
                        "nvidia-smi",
                        "--query-gpu=memory.used",
                        "--format=csv,nounits,noheader",
                    ]
                )
                .decode("utf-8")
                .strip()
            )
        except Exception as e:
            gpu_used = f"Error: {e}"

        # CPU and RAM
        process = psutil.Process()
        ram_usage_mb = process.memory_info().rss / 1024**2
        cpu_percent = process.cpu_percent(interval=1.0)

        # Disk usage
        disk = psutil.disk_usage("/")
        total_disk_gb = disk.total / (1024**3)
        free_disk_gb = disk.free / (1024**3)
        used_disk_gb = disk.used / (1024**3)

        # System Info
        system_info = {
            "os": platform.system(),
            "os_version": platform.version(),
            "cpu_model": platform.processor(),
            "cpu_cores": psutil.cpu_count(logical=False),
            "cpu_threads": psutil.cpu_count(logical=True),
            "python_version": platform.python_version(),
        }

        return {
            "status": "Running",
            "model_loaded": model_loader.is_loaded(),
            "system_info": system_info,
            "gpu_info": memory_info,
            "memory": {
                "ram_process_mb": ram_usage_mb,
                "gpu_stats": memory_info,
                "gpu_used_mb": gpu_used,
            },
            "gpu_data": gpu_data,
            "cpu": {"usage_percent": cpu_percent},
            "storage": {
                "total_gb": total_disk_gb,
                "used_gb": used_disk_gb,
                "free_gb": free_disk_gb,
            },
        }
    except Exception as e:
        logger.error(f"Error getting status: {e}")
        return {"status": "error", "error": str(e)}


@router.get("/health")
async def health_check(req: Request):
    """Simple health check endpoint"""
    try:
        memory_manager = req.app.state.memory_manager
        model_loader = req.app.state.model_loader

        memory_info = memory_manager.get_memory_stats()

        return {
            "status": "healthy",
            "model_loaded": model_loader.is_loaded(),
            "gpu_available": memory_info.get("status") != "unavailable",
            "memory_status": memory_info.get("status", "unknown"),
        }
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}


@router.post("/clear-cache")
async def clear_cache(req: Request):
    """Manually clear CUDA cache"""
    try:
        memory_manager = req.app.state.memory_manager

        memory_before = memory_manager.get_memory_stats()
        success = memory_manager.clear_memory()
        memory_after = memory_manager.get_memory_stats()

        if (
            success
            and memory_before.get("status") == "normal"
            and memory_after.get("status") == "normal"
        ):
            return {
                "status": "success",
                "memory_before_gb": memory_before.get("allocated_gb", 0),
                "memory_after_gb": memory_after.get("allocated_gb", 0),
                "freed_gb": memory_before.get("allocated_gb", 0)
                - memory_after.get("allocated_gb", 0),
            }
        else:
            return {
                "status": "partial_success",
                "message": "Cache cleared but memory info unavailable",
            }

    except Exception as e:
        logger.error(f"Error clearing cache: {str(e)}")
        return {"status": "error", "error": str(e)}
