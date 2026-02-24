"""
Talking Avatar API endpoint using Wav2Lip
"""
import os
import logging
import subprocess
import tempfile
import uuid
from pathlib import Path
from typing import Optional
import aiohttp
import asyncio

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, HttpUrl

logger = logging.getLogger(__name__)

router = APIRouter()

# Bunny CDN config
BUNNY_API_KEY = os.environ.get("BUNNY_API_KEY", "01584fa8-be3f-4f8d-bae3f5080e2c-9d54-41dc")
BUNNY_STORAGE_ZONE = os.environ.get("BUNNY_STORAGE_ZONE", "storage-adultai")
BUNNY_STORAGE_HOST = os.environ.get("BUNNY_STORAGE_HOST", "la.storage.bunnycdn.com")
BUNNY_CDN_URL = os.environ.get("BUNNY_CDN_URL", "https://adultai-com.b-cdn.net")

async def upload_to_cdn(file_path: Path, cdn_path: str) -> str:
    """Upload file to Bunny CDN and return public URL"""
    url = f"https://{BUNNY_STORAGE_HOST}/{BUNNY_STORAGE_ZONE}{cdn_path}"
    async with aiohttp.ClientSession() as session:
        with open(file_path, 'rb') as f:
            data = f.read()
        async with session.put(
            url,
            data=data,
            headers={"AccessKey": BUNNY_API_KEY, "Content-Type": "video/mp4"}
        ) as response:
            if response.status in (200, 201):
                return f"{BUNNY_CDN_URL}{cdn_path}"
            else:
                raise Exception(f"CDN upload failed: {response.status}")

class TalkingAvatarRequest(BaseModel):
    portrait_url: str
    audio_url: str
    fps: Optional[int] = 25
    static: Optional[bool] = True  # Use static image (not video)
    pads: Optional[list] = [0, 10, 0, 0]  # top, bottom, left, right padding

class TalkingAvatarResponse(BaseModel):
    status: str
    video_url: Optional[str] = None
    task_id: str
    message: Optional[str] = None

WAV2LIP_PATH = Path("/root/Wav2Lip")
WAV2LIP_CHECKPOINT = WAV2LIP_PATH / "checkpoints" / "Wav2Lip-SD-GAN.pt"
OUTPUT_DIR = Path("/root/urpm/temp/talking_avatars")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
async def download_file(url: str, output_path: Path) -> bool:
    """Download a file from URL"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=aiohttp.ClientTimeout(total=30)) as response:
                if response.status != 200:
                    logger.error(f"Failed to download {url}: HTTP {response.status}")
                    return False
                
                with open(output_path, 'wb') as f:
                    while True:
                        chunk = await response.content.read(8192)
                        if not chunk:
                            break
                        f.write(chunk)
                
                logger.info(f"Downloaded {url} to {output_path}")
                return True
    except Exception as e:
        logger.error(f"Error downloading {url}: {e}")
        return False
async def run_wav2lip(portrait_path: Path, audio_path: Path, output_path: Path, fps: int = 25, static: bool = True, pads: list = [0, 10, 0, 0]) -> bool:
    """Run Wav2Lip inference"""
    try:
        cmd = [
            "python3",
            str(WAV2LIP_PATH / "inference.py"),
            "--checkpoint_path", str(WAV2LIP_CHECKPOINT),
            "--face", str(portrait_path),
            "--audio", str(audio_path),
            "--outfile", str(output_path),
            "--fps", str(fps),
            "--pads", *[str(p) for p in pads],
        ]
        
        if static:
            cmd.extend(["--static", "True"])
        
        logger.info(f"Running Wav2Lip: {' '.join(cmd)}")
        
        # Run in a thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        )
        
        if result.returncode != 0:
            logger.error(f"Wav2Lip failed: {result.stderr}")
            return False
        
        logger.info(f"Wav2Lip completed successfully: {output_path}")
        return True
        
    except subprocess.TimeoutExpired:
        logger.error("Wav2Lip inference timed out (>120s)")
        return False
    except Exception as e:
        logger.error(f"Error running Wav2Lip: {e}")
        return False

@router.post("/generate", response_model=TalkingAvatarResponse)
async def generate_talking_avatar(request: TalkingAvatarRequest, req: Request):
    """
    Generate a talking avatar video from a portrait image and audio
    
    Args:
        portrait_url: URL to the portrait image (JPG/PNG)
        audio_url: URL to the audio file (MP3/WAV)
        fps: Frames per second for output video (default: 25)
        static: Use static image instead of video (default: True)
        pads: Face padding [top, bottom, left, right] (default: [0, 10, 0, 0])
    
    Returns:
        TalkingAvatarResponse with video URL or error
    """
    task_id = str(uuid.uuid4())
    
    logger.info(f"[{task_id}] Talking avatar request: portrait={request.portrait_url}, audio={request.audio_url}")
    
    # Create temp directory for this task
    task_dir = OUTPUT_DIR / task_id
    task_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        # Download portrait image
        portrait_ext = request.portrait_url.split('.')[-1].lower()
        if portrait_ext not in ['jpg', 'jpeg', 'png']:
            portrait_ext = 'jpg'
        portrait_path = task_dir / f"portrait.{portrait_ext}"
        
        logger.info(f"[{task_id}] Downloading portrait from {request.portrait_url}")
        if not await download_file(request.portrait_url, portrait_path):
            raise HTTPException(status_code=400, detail="Failed to download portrait image")
        
        # Download audio
        audio_ext = request.audio_url.split('.')[-1].lower()
        if audio_ext not in ['mp3', 'wav', 'ogg']:
            audio_ext = 'mp3'
        audio_path = task_dir / f"audio.{audio_ext}"
        
        logger.info(f"[{task_id}] Downloading audio from {request.audio_url}")
        if not await download_file(request.audio_url, audio_path):
            raise HTTPException(status_code=400, detail="Failed to download audio file")
        
        # Run Wav2Lip
        output_path = task_dir / "result.mp4"
        logger.info(f"[{task_id}] Running Wav2Lip inference...")
        
        if not await run_wav2lip(portrait_path, audio_path, output_path, request.fps, request.static, request.pads):
            raise HTTPException(status_code=500, detail="Wav2Lip inference failed")
        
        # Check output file exists
        if not output_path.exists():
            raise HTTPException(status_code=500, detail="Output video was not created")
        
        # Upload to Bunny CDN
        cdn_path = f"/videos/talking_avatar_{task_id}.mp4"
        try:
            video_url = await upload_to_cdn(output_path, cdn_path)
            logger.info(f"[{task_id}] Uploaded to CDN: {video_url}")
        except Exception as e:
            logger.error(f"[{task_id}] CDN upload failed: {e}")
            # Fallback to local path served via API
            video_url = f"/temp/talking_avatars/{task_id}/result.mp4"
        
        logger.info(f"[{task_id}] Talking avatar generated successfully: {video_url}")
        
        return TalkingAvatarResponse(
            status="success",
            video_url=video_url,
            task_id=task_id,
            message="Talking avatar generated successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[{task_id}] Error generating talking avatar: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate talking avatar: {str(e)}")

@router.get("/status/{task_id}")
async def get_task_status(task_id: str):
    """Check the status of a talking avatar generation task"""
    task_dir = OUTPUT_DIR / task_id
    
    if not task_dir.exists():
        raise HTTPException(status_code=404, detail="Task not found")
    
    output_path = task_dir / "result.mp4"
    
    if output_path.exists():
        return {
            "status": "completed",
            "task_id": task_id,
            "video_url": f"/temp/talking_avatars/{task_id}/result.mp4"
        }
    else:
        return {
            "status": "processing",
            "task_id": task_id
        }
