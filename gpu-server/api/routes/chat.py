"""
Chat API endpoint - proxies to local Ollama (dolphin-llama3:8b)
OpenAI-compatible interface for uncensored adult roleplay
"""
import json
import logging
import httpx
import asyncio
from typing import Optional, List, AsyncIterator

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

OLLAMA_URL = "http://localhost:11434/api/chat"
OLLAMA_MODEL = "dolphin-llama3:8b"


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[Message]
    stream: bool = True
    temperature: float = 0.85
    max_tokens: int = 500


async def stream_ollama(messages: list, temperature: float, max_tokens: int) -> AsyncIterator[str]:
    payload = {
        "model": OLLAMA_MODEL,
        "messages": messages,
        "stream": True,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens,
        }
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
                            "choices": [{
                                "delta": {"content": content},
                                "finish_reason": None
                            }]
                        }
                        yield f"data: {json.dumps(chunk)}\n\n"
                except Exception:
                    continue


@router.post("/api/v1/chat/stream")
async def chat_stream(request: ChatRequest):
    """Streaming chat endpoint — SSE, OpenAI delta format"""
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    return StreamingResponse(
        stream_ollama(messages, request.temperature, request.max_tokens),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )


@router.post("/api/v1/chat")
async def chat_sync(request: ChatRequest):
    """Non-streaming chat endpoint"""
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    payload = {
        "model": OLLAMA_MODEL,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": request.temperature,
            "num_predict": request.max_tokens,
        }
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(OLLAMA_URL, json=payload)
        if response.status_code != 200:
            raise HTTPException(status_code=502, detail="Ollama error")
        data = response.json()
        content = data.get("message", {}).get("content", "")
        return {
            "choices": [{
                "message": {"role": "assistant", "content": content},
                "finish_reason": "stop"
            }]
        }
