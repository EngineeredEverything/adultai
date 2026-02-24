"""
GPU Resource Broker — Central coordinator for all GPU workloads.

Single authority that decides what can run on the GPU at any given time.
All services (SD generation, Ollama chat, Wav2Lip, upscale) must acquire
a lease before touching the GPU.

Priority order: IMAGE_GEN > UPSCALE > IMG2IMG > TALKING_AVATAR > CHAT
Policy: If chat is denied for >N seconds, caller should route to CPU/API fallback.
"""

import asyncio
import time
import logging
import subprocess
import torch
from enum import IntEnum
from dataclasses import dataclass, field
from typing import Optional, Dict
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)


class GPUWorkload(IntEnum):
    """Priority levels — higher number = higher priority."""
    CHAT = 10
    TALKING_AVATAR = 20
    UPSCALE = 30
    IMG2IMG = 35
    IMAGE_GEN = 40


# Approximate VRAM requirements (GB) per workload type
VRAM_REQUIREMENTS: Dict[GPUWorkload, float] = {
    GPUWorkload.CHAT: 5.0,           # Ollama dolphin-llama3:8b
    GPUWorkload.TALKING_AVATAR: 2.5,  # Wav2Lip
    GPUWorkload.UPSCALE: 1.5,         # Real-ESRGAN
    GPUWorkload.IMG2IMG: 5.0,          # SD img2img (reuses pipe)
    GPUWorkload.IMAGE_GEN: 6.0,       # SD txt2img + hires fix
}

# Chat fallback timeout — if chat can't acquire GPU within this many seconds,
# the caller should route to CPU/API
CHAT_FALLBACK_TIMEOUT_SECONDS = 8

TOTAL_VRAM_GB = 24.0  # RTX 3090
SYSTEM_OVERHEAD_GB = 2.0  # CUDA context, OS, etc.
AVAILABLE_VRAM_GB = TOTAL_VRAM_GB - SYSTEM_OVERHEAD_GB


@dataclass
class GPULease:
    """Represents an active GPU reservation."""
    lease_id: str
    workload: GPUWorkload
    vram_reserved: float
    acquired_at: float = field(default_factory=time.time)
    description: str = ""


class GPUResourceBroker:
    """
    Singleton coordinator for GPU resource allocation.

    Rules:
    1. Only one lease can be active at a time for heavy workloads (IMAGE_GEN, IMG2IMG, CHAT)
    2. Lightweight workloads (UPSCALE) can coexist with SD if VRAM allows
    3. Higher priority workloads preempt lower priority ones
    4. Chat (Ollama) gets force-unloaded before image generation
    5. If chat can't get a lease within CHAT_FALLBACK_TIMEOUT_SECONDS, return fallback signal
    """

    _instance: Optional["GPUResourceBroker"] = None

    def __init__(self):
        self._active_leases: Dict[str, GPULease] = {}
        self._lock = asyncio.Lock()
        self._lease_counter = 0
        self._wait_queue: asyncio.Queue = asyncio.Queue()

        # Stats
        self.stats = {
            "total_leases_granted": 0,
            "total_leases_denied": 0,
            "total_preemptions": 0,
            "chat_fallbacks": 0,
            "last_activity": None,
        }

    @classmethod
    def get_instance(cls) -> "GPUResourceBroker":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _next_lease_id(self) -> str:
        self._lease_counter += 1
        return f"lease-{self._lease_counter}-{int(time.time())}"

    def _get_used_vram(self) -> float:
        """Sum of VRAM reserved by all active leases."""
        return sum(l.vram_reserved for l in self._active_leases.values())

    def _get_actual_gpu_usage(self) -> float:
        """Get real VRAM usage from nvidia-smi."""
        try:
            if torch.cuda.is_available():
                allocated = torch.cuda.memory_allocated(0) / (1024 ** 3)
                return allocated
        except Exception:
            pass
        return 0.0

    def _highest_active_priority(self) -> int:
        """Return the highest priority among active leases."""
        if not self._active_leases:
            return 0
        return max(l.workload.value for l in self._active_leases.values())

    def _has_conflicting_lease(self, workload: GPUWorkload) -> Optional[GPULease]:
        """Check if there's an active lease that conflicts with the requested workload."""
        for lease in self._active_leases.values():
            # Chat and image gen are mutually exclusive
            if workload == GPUWorkload.CHAT and lease.workload in (
                GPUWorkload.IMAGE_GEN, GPUWorkload.IMG2IMG
            ):
                return lease
            if workload in (GPUWorkload.IMAGE_GEN, GPUWorkload.IMG2IMG) and lease.workload == GPUWorkload.CHAT:
                return lease
            # IMAGE_GEN conflicts with TALKING_AVATAR (both are VRAM-heavy)
            if workload == GPUWorkload.IMAGE_GEN and lease.workload == GPUWorkload.TALKING_AVATAR:
                return lease
            if workload == GPUWorkload.TALKING_AVATAR and lease.workload == GPUWorkload.IMAGE_GEN:
                return lease
        return None

    async def _force_unload_ollama(self):
        """Force Ollama to unload model from VRAM immediately."""
        try:
            import httpx
            async with httpx.AsyncClient(timeout=5.0) as client:
                # Ollama API: setting keep_alive to 0 forces immediate unload
                await client.post(
                    "http://localhost:11434/api/generate",
                    json={"model": "dolphin-llama3:8b", "keep_alive": 0, "prompt": ""},
                )
            logger.info("[broker] Force-unloaded Ollama model from VRAM")
            # Give it a moment to free memory
            await asyncio.sleep(1)
            # Clear CUDA cache
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except Exception as e:
            logger.warning(f"[broker] Failed to force-unload Ollama: {e}")

    async def _preempt_for(self, workload: GPUWorkload) -> bool:
        """
        Preempt lower-priority workloads to make room.
        Returns True if preemption succeeded.
        """
        conflict = self._has_conflicting_lease(workload)
        if not conflict:
            return True

        if workload.value <= conflict.workload.value:
            # Can't preempt higher or equal priority
            return False

        logger.info(
            f"[broker] Preempting {conflict.workload.name} (lease={conflict.lease_id}) "
            f"for {workload.name}"
        )

        # Special handling for chat (Ollama) — force unload
        if conflict.workload == GPUWorkload.CHAT:
            await self._force_unload_ollama()

        # Remove the preempted lease
        del self._active_leases[conflict.lease_id]
        self.stats["total_preemptions"] += 1

        return True

    async def acquire(
        self,
        workload: GPUWorkload,
        description: str = "",
        timeout: Optional[float] = None,
    ) -> Optional[GPULease]:
        """
        Attempt to acquire a GPU lease for the given workload.

        Args:
            workload: Type of GPU work to perform
            description: Human-readable description
            timeout: Max seconds to wait. For CHAT, defaults to CHAT_FALLBACK_TIMEOUT_SECONDS

        Returns:
            GPULease if acquired, None if denied/timed out (caller should fallback)
        """
        if timeout is None:
            timeout = CHAT_FALLBACK_TIMEOUT_SECONDS if workload == GPUWorkload.CHAT else 30.0

        start = time.time()

        while (time.time() - start) < timeout:
            async with self._lock:
                # Check for conflicts
                conflict = self._has_conflicting_lease(workload)

                if conflict is None:
                    # No conflict — check VRAM
                    needed = VRAM_REQUIREMENTS.get(workload, 4.0)
                    used = self._get_used_vram()

                    if (used + needed) <= AVAILABLE_VRAM_GB:
                        lease = GPULease(
                            lease_id=self._next_lease_id(),
                            workload=workload,
                            vram_reserved=needed,
                            description=description,
                        )
                        self._active_leases[lease.lease_id] = lease
                        self.stats["total_leases_granted"] += 1
                        self.stats["last_activity"] = time.time()

                        logger.info(
                            f"[broker] Granted {workload.name} lease={lease.lease_id} "
                            f"vram={needed:.1f}GB (total_used={used + needed:.1f}GB)"
                        )
                        return lease

                elif workload.value > conflict.workload.value:
                    # We have higher priority — preempt
                    preempted = await self._preempt_for(workload)
                    if preempted:
                        continue  # Retry acquisition after preemption

                # Can't acquire yet — wait and retry
                pass

            # Brief wait before retry
            await asyncio.sleep(0.5)

        # Timed out
        self.stats["total_leases_denied"] += 1
        if workload == GPUWorkload.CHAT:
            self.stats["chat_fallbacks"] += 1
            logger.info(
                f"[broker] Chat lease denied after {timeout}s — signaling API fallback"
            )
        else:
            logger.warning(
                f"[broker] {workload.name} lease denied after {timeout}s timeout"
            )

        return None

    async def release(self, lease_id: str):
        """Release a GPU lease, freeing the reserved VRAM."""
        async with self._lock:
            lease = self._active_leases.pop(lease_id, None)
            if lease:
                elapsed = time.time() - lease.acquired_at
                logger.info(
                    f"[broker] Released {lease.workload.name} lease={lease_id} "
                    f"after {elapsed:.1f}s"
                )
                # Clear CUDA cache after heavy workloads
                if lease.workload in (GPUWorkload.IMAGE_GEN, GPUWorkload.IMG2IMG, GPUWorkload.CHAT):
                    if torch.cuda.is_available():
                        torch.cuda.empty_cache()
            else:
                logger.warning(f"[broker] Tried to release unknown lease={lease_id}")

    @asynccontextmanager
    async def lease(
        self,
        workload: GPUWorkload,
        description: str = "",
        timeout: Optional[float] = None,
    ):
        """
        Context manager for GPU lease. Auto-releases on exit.

        Usage:
            async with broker.lease(GPUWorkload.IMAGE_GEN, "txt2img batch") as lease:
                if lease is None:
                    return fallback_response()
                # ... do GPU work ...
        """
        acquired = await self.acquire(workload, description, timeout)
        try:
            yield acquired
        finally:
            if acquired:
                await self.release(acquired.lease_id)

    def get_status(self) -> dict:
        """Return current broker state for monitoring."""
        actual_gpu = self._get_actual_gpu_usage()
        return {
            "active_leases": [
                {
                    "lease_id": l.lease_id,
                    "workload": l.workload.name,
                    "vram_reserved_gb": l.vram_reserved,
                    "age_seconds": round(time.time() - l.acquired_at, 1),
                    "description": l.description,
                }
                for l in self._active_leases.values()
            ],
            "total_reserved_vram_gb": round(self._get_used_vram(), 2),
            "actual_gpu_vram_gb": round(actual_gpu, 2),
            "available_vram_gb": AVAILABLE_VRAM_GB,
            "stats": self.stats,
        }


# ── Module-level singleton ──────────────────────────────────────────────────

_broker: Optional[GPUResourceBroker] = None


def get_broker() -> GPUResourceBroker:
    global _broker
    if _broker is None:
        _broker = GPUResourceBroker()
    return _broker
