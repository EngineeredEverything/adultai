"""
Broker status endpoint — monitoring and diagnostics.
GET /api/v1/broker/status
"""

import logging
import torch
from fastapi import APIRouter, Request

from gpu_resource_broker import get_broker

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/api/v1/broker/status")
async def broker_status(request: Request):
    """Return current GPU broker state, active leases, and VRAM stats."""
    broker = get_broker()
    status = broker.get_status()

    # Add real nvidia-smi data
    gpu_info = {}
    try:
        if torch.cuda.is_available():
            gpu_info = {
                "total_vram_gb": round(
                    torch.cuda.get_device_properties(0).total_mem / (1024 ** 3), 2
                ),
                "allocated_gb": round(torch.cuda.memory_allocated(0) / (1024 ** 3), 2),
                "reserved_gb": round(torch.cuda.memory_reserved(0) / (1024 ** 3), 2),
                "free_gb": round(
                    (
                        torch.cuda.get_device_properties(0).total_mem
                        - torch.cuda.memory_allocated(0)
                    )
                    / (1024 ** 3),
                    2,
                ),
                "device_name": torch.cuda.get_device_name(0),
            }
    except Exception as e:
        gpu_info = {"error": str(e)}

    return {
        **status,
        "gpu_hardware": gpu_info,
    }
