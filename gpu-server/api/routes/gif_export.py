"""
GIF Export Route — convert a video URL to an animated GIF
"""
import os
import uuid
import subprocess
import tempfile
import aiohttp
import asyncio
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()
TEMP_DIR = "/root/urpm/temp"
os.makedirs(TEMP_DIR, exist_ok=True)


class GifExportRequest(BaseModel):
    video_url: str
    fps: int = 12
    width: int = 480   # output GIF width in px (-1 = keep aspect)
    start: float = 0   # start time in seconds
    duration: float = 4  # how many seconds to capture


@router.post("/api/v1/video/to-gif")
async def video_to_gif(req: GifExportRequest):
    """Download a video and convert it to an animated GIF using ffmpeg."""
    if not req.video_url.startswith("http"):
        raise HTTPException(status_code=400, detail="Invalid video_url")

    fps = max(6, min(req.fps, 24))
    width = max(240, min(req.width, 800))
    duration = max(1.0, min(req.duration, 10.0))
    start = max(0.0, req.start)

    uid = uuid.uuid4().hex[:12]
    video_path = os.path.join(TEMP_DIR, f"tmp_{uid}.mp4")
    gif_path = os.path.join(TEMP_DIR, f"gif_{uid}.gif")
    palette_path = os.path.join(TEMP_DIR, f"pal_{uid}.png")

    try:
        # Step 1: Download video
        async with aiohttp.ClientSession() as session:
            async with session.get(req.video_url, timeout=aiohttp.ClientTimeout(total=60)) as r:
                if r.status != 200:
                    raise HTTPException(status_code=502, detail="Failed to download video")
                with open(video_path, "wb") as f:
                    f.write(await r.read())

        # Step 2: Generate palette for better GIF quality
        palette_cmd = [
            "ffmpeg", "-y",
            "-ss", str(start),
            "-t", str(duration),
            "-i", video_path,
            "-vf", f"fps={fps},scale={width}:-1:flags=lanczos,palettegen=max_colors=128",
            palette_path
        ]
        result = subprocess.run(palette_cmd, capture_output=True, timeout=60)
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail="Palette generation failed")

        # Step 3: Generate GIF using palette
        gif_cmd = [
            "ffmpeg", "-y",
            "-ss", str(start),
            "-t", str(duration),
            "-i", video_path,
            "-i", palette_path,
            "-lavfi", f"fps={fps},scale={width}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer",
            gif_path
        ]
        result = subprocess.run(gif_cmd, capture_output=True, timeout=60)
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail="GIF conversion failed")

        if not os.path.exists(gif_path):
            raise HTTPException(status_code=500, detail="GIF file not created")

        gif_size = os.path.getsize(gif_path)
        gif_filename = f"gif_{uid}.gif"
        gif_url = f"http://213.224.31.105:29612/temp/{gif_filename}"

        return {"gif_url": gif_url, "size_bytes": gif_size, "filename": gif_filename}

    finally:
        # Cleanup input files (keep GIF for serving)
        for path in [video_path, palette_path]:
            try:
                os.remove(path)
            except Exception:
                pass
