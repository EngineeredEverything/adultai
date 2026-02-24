import logging
import threading
import torch
import base64
import io
import cv2
import numpy as np
import traceback
import psutil
import time
from io import BytesIO
from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from PIL import Image
from typing import Optional, List

from core.config import settings
from core.task_manager import task_manager
from api.models.video_requests import VideoRequest, ImageToVideoRequest

logger = logging.getLogger(__name__)
router = APIRouter()

# Add more detailed logging configuration
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s'
)

def log_system_resources(context: str):
    """Log current system resource usage"""
    try:
        process = psutil.Process()
        cpu_percent = process.cpu_percent(interval=0.1)
        memory_info = process.memory_info()
        memory_mb = memory_info.rss / 1024 / 1024
        
        # GPU info
        if torch.cuda.is_available():
            gpu_memory_allocated = torch.cuda.memory_allocated() / 1024**3
            gpu_memory_reserved = torch.cuda.memory_reserved() / 1024**3
            gpu_info = f"GPU Mem: {gpu_memory_allocated:.2f}GB allocated, {gpu_memory_reserved:.2f}GB reserved"
        else:
            gpu_info = "GPU not available"
        
        logger.info(f"[{context}] CPU: {cpu_percent}%, RAM: {memory_mb:.2f}MB, {gpu_info}")
    except Exception as e:
        logger.error(f"Error logging system resources: {e}")

def encode_video_to_base64(frames: List[np.ndarray], fps: int = 7) -> str:
    """Encode video frames to base64 MP4 with extensive debugging"""
    logger.info(f"[ENCODE_VIDEO] Starting video encoding with {len(frames)} frames at {fps} FPS")
    log_system_resources("encode_video_start")
    
    try:
        # Validate frames
        if not frames or len(frames) == 0:
            raise ValueError("No frames provided for encoding")
        
        logger.debug(f"[ENCODE_VIDEO] First frame shape: {frames[0].shape}, dtype: {frames[0].dtype}")
        
        # Create temporary buffer for video
        buffer = io.BytesIO()
        
        # Get frame dimensions
        height, width = frames[0].shape[:2]
        logger.info(f"[ENCODE_VIDEO] Video dimensions: {width}x{height}")
        
        # Create video writer with MP4 codec
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        temp_path = f"/tmp/temp_video_{threading.get_ident()}_{int(time.time())}.mp4"
        logger.debug(f"[ENCODE_VIDEO] Creating temp file: {temp_path}")
        
        out = cv2.VideoWriter(temp_path, fourcc, fps, (width, height))
        
        if not out.isOpened():
            raise RuntimeError("Failed to open VideoWriter")
        
        logger.debug(f"[ENCODE_VIDEO] Writing {len(frames)} frames to video file")
        for i, frame in enumerate(frames):
            if i % 5 == 0:  # Log every 5th frame
                logger.debug(f"[ENCODE_VIDEO] Writing frame {i}/{len(frames)}")
            
            # Convert RGB to BGR for OpenCV
            frame_bgr = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
            out.write(frame_bgr)
        
        out.release()
        logger.info(f"[ENCODE_VIDEO] Video file written successfully")
        
        # Read the video file and encode to base64
        logger.debug(f"[ENCODE_VIDEO] Reading video file for base64 encoding")
        with open(temp_path, 'rb') as f:
            video_bytes = f.read()
        
        video_size_mb = len(video_bytes) / 1024 / 1024
        logger.info(f"[ENCODE_VIDEO] Video file size: {video_size_mb:.2f}MB")
        
        # Clean up temp file
        import os
        os.remove(temp_path)
        logger.debug(f"[ENCODE_VIDEO] Temp file removed")
        
        logger.info(f"[ENCODE_VIDEO] Encoding to base64...")
        encoded = base64.b64encode(video_bytes).decode()
        logger.info(f"[ENCODE_VIDEO] Base64 encoding complete, length: {len(encoded)}")
        
        log_system_resources("encode_video_end")
        return encoded
        
    except Exception as e:
        logger.error(f"[ENCODE_VIDEO] Error encoding video: {e}")
        logger.error(f"[ENCODE_VIDEO] Traceback: {traceback.format_exc()}")
        raise

def generate_video_task(task_id: str, task_data: dict, error_manager, memory_manager, video_model_loader):
    """Background task for video generation with comprehensive debugging"""
    logger.info(f"[TASK_{task_id}] ========== VIDEO GENERATION TASK STARTED ==========")
    log_system_resources(f"task_{task_id}_start")
    
    webhook_url = task_data.get("webhook")
    track_id = task_data.get("track_id")
    
    try:
        logger.info(f"[TASK_{task_id}] Task data: {task_data}")
        logger.debug(f"[TASK_{task_id}] Thread ID: {threading.get_ident()}, Thread name: {threading.current_thread().name}")
        
        # Send initial webhook
        if webhook_url:
            logger.info(f"[TASK_{task_id}] Sending initial webhook to {webhook_url}")
            try:
                from api.utils.webhook import send_webhook
                webhook_data = {
                    "id": task_id,
                    "status": "processing",
                    "eta": task_manager.get_task(task_id)["eta"],
                    "output": None,
                    "track_id": track_id
                }
                send_webhook(webhook_url, webhook_data)
                logger.info(f"[TASK_{task_id}] Initial webhook sent successfully")
            except Exception as webhook_error:
                logger.error(f"[TASK_{task_id}] Failed to send initial webhook: {webhook_error}")
        
        # Extract parameters
        logger.info(f"[TASK_{task_id}] Extracting parameters...")
        prompt = task_data.get("prompt", "")
        negative_prompt = task_data.get("negative_prompt", "")
        steps = min(task_data.get("num_inference_steps", 50), settings.MAX_VIDEO_STEPS)
        guidance = task_data.get("guidance_scale", 7.5)
        height = min(task_data.get("height", 512), settings.MAX_VIDEO_RESOLUTION)
        width = min(task_data.get("width", 512), settings.MAX_VIDEO_RESOLUTION)
        num_frames = min(task_data.get("num_frames", 14), settings.MAX_VIDEO_FRAMES)
        fps = task_data.get("fps", 7)
        seed = task_data.get("seed")
        motion_bucket_id = task_data.get("motion_bucket_id", 127)
        noise_aug_strength = task_data.get("noise_aug_strength", 0.02)
        decode_chunk_size = task_data.get("decode_chunk_size", 8)
        
        logger.info(f"[TASK_{task_id}] Parameters extracted:")
        logger.info(f"  - Prompt: {prompt[:100]}...")
        logger.info(f"  - Steps: {steps}, Guidance: {guidance}")
        logger.info(f"  - Resolution: {width}x{height}, Frames: {num_frames}, FPS: {fps}")
        logger.info(f"  - Seed: {seed}, Motion Bucket: {motion_bucket_id}")
        
        # Check memory availability
        logger.info(f"[TASK_{task_id}] Checking memory availability...")
        estimated_memory = memory_manager.estimate_memory_requirement(height, width, 1, steps) * num_frames * 1.5
        memory_info = memory_manager.get_gpu_memory_info()
        
        logger.info(f"[TASK_{task_id}] Memory check:")
        logger.info(f"  - Estimated requirement: {estimated_memory:.2f}GB")
        logger.info(f"  - GPU memory info: {memory_info}")
        
        if memory_info and estimated_memory > memory_info['free_gb'] * 0.7:
            error_msg = f"Insufficient GPU memory: need {estimated_memory:.2f}GB, have {memory_info['free_gb']:.2f}GB free"
            logger.error(f"[TASK_{task_id}] {error_msg}")
            error_manager.log_error("insufficient_memory_video", error_msg, {
                "requested_resolution": f"{width}x{height}",
                "requested_frames": num_frames,
                "estimated_memory_gb": estimated_memory,
                "memory_info": memory_manager.get_memory_stats()
            }, task_id)
            raise Exception(error_msg)
        
        # Update progress
        logger.debug(f"[TASK_{task_id}] Updating progress to 10%")
        task_manager.update_task(task_id, progress=10)
        log_system_resources(f"task_{task_id}_after_memory_check")
        
        # Set seed if provided
        generator = None
        if seed is not None:
            logger.info(f"[TASK_{task_id}] Setting random seed: {seed}")
            generator = torch.Generator(device="cuda").manual_seed(seed)
        
        # Generate video with memory management
        logger.info(f"[TASK_{task_id}] ========== STARTING VIDEO GENERATION ==========")
        log_system_resources(f"task_{task_id}_before_generation")
        
        with video_model_loader.memory_managed_generation() as pipe:
            logger.info(f"[TASK_{task_id}] Pipeline acquired, generating {num_frames} frames...")
            
            # Update progress
            task_manager.update_task(task_id, progress=30)
            
            # Log pipeline info
            logger.debug(f"[TASK_{task_id}] Pipeline type: {type(pipe)}")
            logger.debug(f"[TASK_{task_id}] Pipeline device: {pipe.device if hasattr(pipe, 'device') else 'unknown'}")
            
            try:
                logger.info(f"[TASK_{task_id}] Calling pipeline...")
                generation_start = time.time()
                
                # Prepare generation parameters
                gen_params = {
                    "prompt": prompt,
                    "num_inference_steps": steps,
                    "guidance_scale": guidance,
                    "height": height,
                    "width": width,
                    "num_frames": num_frames,
                }
                
                # Add optional parameters if they exist
                if negative_prompt:
                    gen_params["negative_prompt"] = negative_prompt
                if generator is not None:
                    gen_params["generator"] = generator
                
                # Detect pipeline type and adjust parameters
                pipeline_type = type(pipe).__name__
                logger.info(f"[TASK_{task_id}] Pipeline type: {pipeline_type}")
                
                if "CogVideo" in pipeline_type:
                    # CogVideoX text-to-video
                    logger.info(f"[TASK_{task_id}] Using CogVideoX pipeline")
                    # CogVideoX uses different guidance default (6.0)
                    if gen_params.get("guidance_scale", 7.5) > 7.0:
                        gen_params["guidance_scale"] = 6.0
                    # CogVideoX works best with these frame counts: 49 frames = 6s at 8fps
                    if gen_params.get("num_frames", 14) < 49:
                        gen_params["num_frames"] = 49
                elif hasattr(pipe, 'unet') and hasattr(pipe.unet.config, 'addition_embed_type'):
                    # SVD image-to-video model
                    logger.info(f"[TASK_{task_id}] Detected image-to-video pipeline")
                    gen_params["motion_bucket_id"] = motion_bucket_id
                    gen_params["noise_aug_strength"] = noise_aug_strength
                    if decode_chunk_size:
                        gen_params["decode_chunk_size"] = decode_chunk_size
                else:
                    logger.info(f"[TASK_{task_id}] Generic text-to-video pipeline")
                
                logger.info(f"[TASK_{task_id}] Generation parameters: {list(gen_params.keys())}")
                
                # Generate video
                result = pipe(**gen_params)
                
                generation_time = time.time() - generation_start
                logger.info(f"[TASK_{task_id}] Generation completed in {generation_time:.2f} seconds")
                log_system_resources(f"task_{task_id}_after_generation")
                
            except Exception as gen_error:
                logger.error(f"[TASK_{task_id}] GENERATION FAILED: {gen_error}")
                logger.error(f"[TASK_{task_id}] Generation traceback: {traceback.format_exc()}")
                raise
            
            # Update progress
            task_manager.update_task(task_id, progress=80)
            
            # Process frames
            logger.info(f"[TASK_{task_id}] Processing generated frames...")
            logger.debug(f"[TASK_{task_id}] Result type: {type(result)}")
            logger.debug(f"[TASK_{task_id}] Result attributes: {dir(result)}")
            
            frames = result.frames[0]  # Get first video
            logger.info(f"[TASK_{task_id}] Got {len(frames)} frames")
            logger.debug(f"[TASK_{task_id}] First frame type: {type(frames[0])}")
            
            # Convert PIL images to numpy arrays
            logger.info(f"[TASK_{task_id}] Converting frames to numpy arrays...")
            frame_arrays = []
            for i, frame in enumerate(frames):
                if i % 5 == 0:
                    logger.debug(f"[TASK_{task_id}] Converting frame {i}/{len(frames)}")
                frame_arrays.append(np.array(frame))
            
            logger.info(f"[TASK_{task_id}] Frames converted successfully")
            log_system_resources(f"task_{task_id}_after_frame_conversion")
            
            # Encode video to base64
            logger.info(f"[TASK_{task_id}] Encoding video to base64...")
            encoding_start = time.time()
            video_base64 = encode_video_to_base64(frame_arrays, fps)
            encoding_time = time.time() - encoding_start
            logger.info(f"[TASK_{task_id}] Video encoded in {encoding_time:.2f} seconds")
            
            # Clear memory
            logger.info(f"[TASK_{task_id}] Clearing memory...")
            memory_manager.clear_memory()
            log_system_resources(f"task_{task_id}_after_memory_clear")
        
        # Final progress update
        logger.info(f"[TASK_{task_id}] Updating task to success status")
        task_manager.update_task(task_id, status="success", output=video_base64, progress=100)
        logger.info(f"[TASK_{task_id}] ========== TASK COMPLETED SUCCESSFULLY ==========")
        log_system_resources(f"task_{task_id}_complete")
        
        # Send success webhook
        if webhook_url:
            logger.info(f"[TASK_{task_id}] Sending success webhook")
            try:
                from api.utils.webhook import send_webhook
                webhook_data = {
                    "id": task_id,
                    "status": "success",
                    "output": video_base64,
                    "track_id": track_id
                }
                send_webhook(webhook_url, webhook_data)
                logger.info(f"[TASK_{task_id}] Success webhook sent")
            except Exception as webhook_error:
                logger.error(f"[TASK_{task_id}] Failed to send success webhook: {webhook_error}")
            
    except Exception as e:
        error_msg = str(e)
        logger.error(f"[TASK_{task_id}] ========== TASK FAILED ==========")
        logger.error(f"[TASK_{task_id}] Error: {error_msg}")
        logger.error(f"[TASK_{task_id}] Full traceback:\n{traceback.format_exc()}")
        log_system_resources(f"task_{task_id}_error")
        
        try:
            error_manager.log_error("task_video_generation_failed", error_msg, {
                "task_id": task_id,
                "prompt": task_data.get("prompt", "")[:100],
                "parameters": {
                    "width": task_data.get("width"),
                    "height": task_data.get("height"),
                    "num_frames": task_data.get("num_frames"),
                    "steps": task_data.get("num_inference_steps")
                },
                "traceback": traceback.format_exc()
            }, task_id)
        except Exception as log_error:
            logger.error(f"[TASK_{task_id}] Failed to log error: {log_error}")
        
        task_manager.update_task(task_id, status="failed", error=error_msg)
        
        # Send error webhook
        if webhook_url:
            logger.info(f"[TASK_{task_id}] Sending error webhook")
            try:
                from api.utils.webhook import send_webhook
                webhook_data = {
                    "id": task_id,
                    "status": "failed",
                    "error": error_msg,
                    "track_id": track_id
                }
                send_webhook(webhook_url, webhook_data)
            except Exception as webhook_error:
                logger.error(f"[TASK_{task_id}] Failed to send error webhook: {webhook_error}")
    
    finally:
        logger.info(f"[TASK_{task_id}] Task thread finishing")
        log_system_resources(f"task_{task_id}_finally")

@router.post("/generate-video")
async def generate_video(request: VideoRequest, req: Request):
    """Generate video from text prompt"""
    logger.info(f"[ENDPOINT] /generate-video called")
    log_system_resources("endpoint_start")
    
    try:
        error_manager = req.app.state.error_manager
        memory_manager = req.app.state.memory_manager
        video_model_loader = req.app.state.video_model_loader
        
        logger.debug(f"[ENDPOINT] Request data: {request.dict()}")
        
        # Validate model is loaded
        logger.info(f"[ENDPOINT] Checking if video model is loaded...")
        if not video_model_loader.is_loaded():
            logger.error(f"[ENDPOINT] Video model is NOT loaded!")
            error_manager.log_critical_error("video_model_not_loaded", "Video model is not loaded", {
                "endpoint": "/generate-video"
            })
            raise HTTPException(status_code=503, detail="Video model not loaded. Please try again later.")
        
        logger.info(f"[ENDPOINT] Video model is loaded")
        
        # Validate parameters
        if request.height > settings.MAX_VIDEO_RESOLUTION or request.width > settings.MAX_VIDEO_RESOLUTION:
            logger.warning(f"[ENDPOINT] Resolution exceeds maximum: {request.width}x{request.height}")
            raise HTTPException(
                status_code=400, 
                detail=f"Maximum resolution is {settings.MAX_VIDEO_RESOLUTION}x{settings.MAX_VIDEO_RESOLUTION}"
            )
        
        if request.num_frames > settings.MAX_VIDEO_FRAMES:
            logger.warning(f"[ENDPOINT] Frame count exceeds maximum: {request.num_frames}")
            raise HTTPException(status_code=400, detail=f"Maximum {settings.MAX_VIDEO_FRAMES} frames per request")
        
        # Always use async processing for videos due to long generation time
        logger.info(f"[ENDPOINT] Creating video generation task for prompt: {request.prompt[:50]}...")
        
        task_data = request.dict()
        task_id = task_manager.create_task(task_data)
        logger.info(f"[ENDPOINT] Task created with ID: {task_id}")
        
        # Start generation in background thread
        logger.info(f"[ENDPOINT] Starting background thread for task {task_id}")
        thread = threading.Thread(
            target=generate_video_task, 
            args=(task_id, task_data, error_manager, memory_manager, video_model_loader),
            name=f"VideoGen_{task_id[:8]}"
        )
        thread.daemon = True
        thread.start()
        logger.info(f"[ENDPOINT] Background thread started: {thread.name}")
        
        task = task_manager.get_task(task_id)
        response = {
            "id": task_id,
            "eta": task["eta"],
            "output": None,
            "status": "processing"
        }
        
        logger.info(f"[ENDPOINT] Returning response for task {task_id}")
        log_system_resources("endpoint_end")
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[ENDPOINT] Unexpected error: {e}")
        logger.error(f"[ENDPOINT] Traceback:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/image-to-video")
async def image_to_video(request: ImageToVideoRequest, req: Request):
    """Generate video from input image"""
    logger.info(f"[ENDPOINT] /image-to-video called")
    log_system_resources("image_to_video_start")
    
    try:
        error_manager = req.app.state.error_manager
        memory_manager = req.app.state.memory_manager
        video_model_loader = req.app.state.video_model_loader
        
        # Validate model is loaded
        if not video_model_loader.is_loaded():
            logger.error(f"[ENDPOINT] Video model is NOT loaded!")
            error_manager.log_critical_error("video_model_not_loaded", "Video model is not loaded", {
                "endpoint": "/image-to-video"
            })
            raise HTTPException(status_code=503, detail="Video model not loaded. Please try again later.")
        
        # Validate parameters
        if request.num_frames > settings.MAX_VIDEO_FRAMES:
            raise HTTPException(status_code=400, detail=f"Maximum {settings.MAX_VIDEO_FRAMES} frames per request")
        
        logger.info(f"[ENDPOINT] Creating image-to-video generation task")
        
        task_data = request.dict()
        task_data["is_image_to_video"] = True
        task_id = task_manager.create_task(task_data)
        
        # Start generation in background thread
        thread = threading.Thread(
            target=generate_video_task, 
            args=(task_id, task_data, error_manager, memory_manager, video_model_loader),
            name=f"ImgToVideo_{task_id[:8]}"
        )
        thread.daemon = True
        thread.start()
        
        task = task_manager.get_task(task_id)
        return {
            "id": task_id,
            "eta": task["eta"],
            "output": None,
            "status": "processing"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[ENDPOINT] Unexpected error: {e}")
        logger.error(f"[ENDPOINT] Traceback:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.get("/fetch-video/{task_id}")
async def fetch_video_task(task_id: str):
    """Fetch video generation task status and results"""
    logger.debug(f"[FETCH] Fetching video task {task_id}")
    task = task_manager.get_task(task_id)
    if not task:
        logger.warning(f"[FETCH] Task {task_id} not found")
        raise HTTPException(status_code=404, detail="Task not found")
    
    response = {
        "id": task_id,
        "eta": task["eta"],
        "output": task["output"],
        "status": task["status"],
        "progress": task.get("progress", 0)
    }
    
    if task.get("error"):
        response["error"] = task["error"]
    
    logger.debug(f"[FETCH] Task {task_id} status: {task['status']}, progress: {task.get('progress', 0)}%")
    return response