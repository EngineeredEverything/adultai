import os
from typing import Optional
from dotenv import load_dotenv

# Load variables from .env file into environment
load_dotenv()


class Settings:
    # Server settings
    PORT: int = int(os.getenv("PORT", 8080))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    
    # Model settings
    MODEL_PATH: str = os.getenv("MODEL_PATH", "/root/urpm/model/")
    # VIDEO_MODEL_PATH: str = os.getenv("VIDEO_MODEL_PATH", "/root/urpm/video_model/")
    VIDEO_MODEL_PATH: str = os.getenv("VIDEO_MODEL_PATH", "/root/urpm/video_model_cogvideox")
    
    # Memory settings
    MIN_FREE_MEMORY_GB: float = float(os.getenv("MIN_FREE_MEMORY_GB", 1.0))
    MAX_BATCH_SIZE: int = int(os.getenv("MAX_BATCH_SIZE", 1))
    MEMORY_SAFETY_FACTOR: float = float(os.getenv("MEMORY_SAFETY_FACTOR", 0.7))
    
    # Error management settings
    ERROR_LOG_DIR: str = os.getenv("ERROR_LOG_DIR", "./logs/errors")
    MAX_ERROR_LOGS: int = int(os.getenv("MAX_ERROR_LOGS", 1000))
    ERROR_LOOP_THRESHOLD: int = int(os.getenv("ERROR_LOOP_THRESHOLD", 3))
    ERROR_LOOP_WINDOW_MINUTES: int = int(os.getenv("ERROR_LOOP_WINDOW_MINUTES", 10))
    
    # Generation limits
    MAX_RESOLUTION: int = int(os.getenv("MAX_RESOLUTION", 1024))
    MAX_SAMPLES: int = int(os.getenv("MAX_SAMPLES", 4))
    MAX_STEPS: int = int(os.getenv("MAX_STEPS", 100))
    
    MAX_VIDEO_RESOLUTION: int = int(os.getenv("MAX_VIDEO_RESOLUTION", 720))
    MAX_VIDEO_FRAMES: int = int(os.getenv("MAX_VIDEO_FRAMES", 49))
    MAX_VIDEO_STEPS: int = int(os.getenv("MAX_VIDEO_STEPS", 50))
    
    # Webhook settings
    WEBHOOK_TIMEOUT: int = int(os.getenv("WEBHOOK_TIMEOUT", 10))
    WEBHOOK_MAX_RETRIES: int = int(os.getenv("WEBHOOK_MAX_RETRIES", 3))
    
    # Queue system settings
    QUEUE_MAX_SIZE: int = int(os.getenv("QUEUE_MAX_SIZE", 100))
    QUEUE_BATCH_SIZE: int = int(os.getenv("QUEUE_BATCH_SIZE", 3))
    QUEUE_PROCESSING_TIMEOUT: int = int(os.getenv("QUEUE_PROCESSING_TIMEOUT", 300))
    QUEUE_HIGH_PRIORITY_THRESHOLD: float = float(os.getenv("QUEUE_HIGH_PRIORITY_THRESHOLD", 0.3))
    QUEUE_PARALLEL_WORKERS: int = int(os.getenv("QUEUE_PARALLEL_WORKERS", 2))
    QUEUE_MEMORY_THRESHOLD_GB: float = float(os.getenv("QUEUE_MEMORY_THRESHOLD_GB", 8.0))
    QUEUE_AUTO_SCALING: bool = os.getenv("QUEUE_AUTO_SCALING", "true").lower() == "true"

settings = Settings()
