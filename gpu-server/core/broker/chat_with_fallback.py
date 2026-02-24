"""
Chat route with GPU broker integration + API fallback.

Flow:
1. Try to acquire GPU lease for Ollama (local LLM)
2. If broker grants lease → use Ollama (fast, free, uncensored)
3. If broker denies (GPU busy) → route to CPU/API fallback
4. Fallback chain: Groq (free llama) → OpenAI → error

This replaces the existing chat.py route.
"""

import json
import logging
import os
from typing import Optional, List, AsyncIterator

import httpx
import asyncio
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from core.broker.gpu_resource_broker import get_broker, GPUWorkload

logger = logging.getLogger(__name__)
router = APIRouter()

OLLAMA_URL = "http://localhost:11434/api/chat"
OLLAMA_MODEL = "dolphin-llama3:8b"

# Fallback config — set via environment
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL = os.environ.get("GROQ_CHAT_MODEL", "llama-3.1-8b-instant")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_MODEL = os.environ.get("OPENAI_CHAT_MODEL", "gpt-4o-mini")
OPENAI_URL = "https://api.openai.com/v1/chat/completions"

# How long to wait for GPU lease before falling back (seconds)
CHAT_GPU_TIMEOUT = float(os.environ.get("CHAT_GPU_TIMEOUT", "8"))


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[Message]
    stream: bool = True
    temperature: float = 0.85
    max_tokens: int = 500


# ── Ollama (local GPU) ──────────────────────────────────────────────────────

async def stream_ollama(messages: list, temperature: float, max_tokens: int) -> AsyncIterator[str]:
    payload = {
        "model": OLLAMA_MODEL,
        "messages": messages,
        "stream": True,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens,
        },
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream("POST", OLLAMA_URL, json=payload) as response:
            if response.status_code != 200:
                raise HTTPException(status_code=502, detail="Ollama error")
            async for line in response.aiter_lines():
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    if data.get("done"):
                        yield "data: [DONE]\n\n"
                        break
                    content = data.get("message", {}).get("content", "")
                    if content:
                        chunk = {
                            "choices": [
                                {
                                    "delta": {"content": content},
                                    "finish_reason": None,
                                }
                            ]
                        }
                        yield f"data: {json.dumps(chunk)}\n\n"
                except Exception:
                    continue


async def call_ollama_sync(messages: list, temperature: float, max_tokens: int) -> str:
    payload = {
        "model": OLLAMA_MODEL,
        "messages": messages,
        "stream": False,
        "options": {"temperature": temperature, "num_predict": max_tokens},
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(OLLAMA_URL, json=payload)
        if response.status_code != 200:
            raise Exception(f"Ollama error: {response.status_code}")
        data = response.json()
        return data.get("message", {}).get("content", "")


# ── Groq fallback (free, fast) ──────────────────────────────────────────────

async def stream_groq(messages: list, temperature: float, max_tokens: int) -> AsyncIterator[str]:
    if not GROQ_API_KEY:
        raise Exception("Groq API key not configured")

    payload = {
        "model": GROQ_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": True,
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        async with client.stream(
            "POST",
            GROQ_URL,
            json=payload,
            headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
        ) as response:
            if response.status_code != 200:
                body = await response.aread()
                raise Exception(f"Groq error {response.status_code}: {body.decode()[:200]}")
            async for line in response.aiter_lines():
                if not line or not line.startswith("data: "):
                    continue
                if line == "data: [DONE]":
                    yield "data: [DONE]\n\n"
                    break
                yield f"{line}\n\n"


async def call_groq_sync(messages: list, temperature: float, max_tokens: int) -> str:
    if not GROQ_API_KEY:
        raise Exception("Groq API key not configured")

    payload = {
        "model": GROQ_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": False,
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            GROQ_URL,
            json=payload,
            headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
        )
        if response.status_code != 200:
            raise Exception(f"Groq error: {response.status_code}")
        data = response.json()
        return data["choices"][0]["message"]["content"]


# ── OpenAI fallback (paid, last resort) ─────────────────────────────────────

async def stream_openai(messages: list, temperature: float, max_tokens: int) -> AsyncIterator[str]:
    if not OPENAI_API_KEY:
        raise Exception("OpenAI API key not configured")

    payload = {
        "model": OPENAI_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": True,
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        async with client.stream(
            "POST",
            OPENAI_URL,
            json=payload,
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
        ) as response:
            if response.status_code != 200:
                body = await response.aread()
                raise Exception(f"OpenAI error {response.status_code}: {body.decode()[:200]}")
            async for line in response.aiter_lines():
                if not line or not line.startswith("data: "):
                    continue
                if line == "data: [DONE]":
                    yield "data: [DONE]\n\n"
                    break
                yield f"{line}\n\n"


async def call_openai_sync(messages: list, temperature: float, max_tokens: int) -> str:
    if not OPENAI_API_KEY:
        raise Exception("OpenAI API key not configured")

    payload = {
        "model": OPENAI_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": False,
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            OPENAI_URL,
            json=payload,
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
        )
        if response.status_code != 200:
            raise Exception(f"OpenAI error: {response.status_code}")
        data = response.json()
        return data["choices"][0]["message"]["content"]


# ── Smart router ─────────────────────────────────────────────────────────────

async def route_chat(
    messages: list, temperature: float, max_tokens: int, stream: bool
):
    """
    Try GPU (Ollama) first, fall back to API if GPU is busy.
    Returns (response_data_or_iterator, backend_used)
    """
    broker = get_broker()

    # Try to get a GPU lease for chat
    lease = await broker.acquire(
        GPUWorkload.CHAT,
        description="companion chat",
        timeout=CHAT_GPU_TIMEOUT,
    )

    if lease is not None:
        # Got GPU — use Ollama
        try:
            if stream:
                return stream_ollama(messages, temperature, max_tokens), "ollama", lease
            else:
                content = await call_ollama_sync(messages, temperature, max_tokens)
                await broker.release(lease.lease_id)
                return content, "ollama", None
        except Exception as e:
            await broker.release(lease.lease_id)
            logger.warning(f"[chat] Ollama failed: {e}, falling back to API")
            # Fall through to API fallback

    # GPU unavailable or Ollama failed — try API fallbacks
    logger.info("[chat] GPU busy or unavailable, routing to API fallback")

    # Fallback 1: Groq (free, fast)
    if GROQ_API_KEY:
        try:
            if stream:
                return stream_groq(messages, temperature, max_tokens), "groq", None
            else:
                content = await call_groq_sync(messages, temperature, max_tokens)
                return content, "groq", None
        except Exception as e:
            logger.warning(f"[chat] Groq fallback failed: {e}")

    # Fallback 2: OpenAI (paid)
    if OPENAI_API_KEY:
        try:
            if stream:
                return stream_openai(messages, temperature, max_tokens), "openai", None
            else:
                content = await call_openai_sync(messages, temperature, max_tokens)
                return content, "openai", None
        except Exception as e:
            logger.warning(f"[chat] OpenAI fallback failed: {e}")

    raise HTTPException(
        status_code=503,
        detail="All chat backends unavailable. GPU is busy and no API fallback configured.",
    )


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/api/v1/chat/stream")
async def chat_stream(request: ChatRequest):
    """Streaming chat — tries GPU, falls back to API."""
    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    iterator, backend, lease = await route_chat(
        messages, request.temperature, request.max_tokens, stream=True
    )

    async def wrapped_stream():
        try:
            async for chunk in iterator:
                yield chunk
        finally:
            if lease:
                broker = get_broker()
                await broker.release(lease.lease_id)

    return StreamingResponse(
        wrapped_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "X-Chat-Backend": backend,
        },
    )


@router.post("/api/v1/chat")
async def chat_sync(request: ChatRequest):
    """Non-streaming chat — tries GPU, falls back to API."""
    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    content, backend, _ = await route_chat(
        messages, request.temperature, request.max_tokens, stream=False
    )

    return {
        "choices": [
            {
                "message": {"role": "assistant", "content": content},
                "finish_reason": "stop",
            }
        ],
        "backend": backend,
    }
