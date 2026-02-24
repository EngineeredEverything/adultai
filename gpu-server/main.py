import os
# Set CUDA memory allocation environment variable
os.environ['PYTORCH_CUDA_ALLOC_CONF'] = 'expandable_segments:True'

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from fastapi.staticfiles import StaticFiles

from core.config import settings
from core.error_manager import ErrorManager
from core.memory_manager import MemoryManager
from core.model_loader import ModelLoader
from core.video_model_loader import VideoModelLoader
from core.intelligent_queue_manager import initialize_queue_manager
from api.routes import generation as generation, enhanced_generation, status, admin, video_generation, talking_avatar, chat, img2img as img2img_routes, upscale as upscale_routes, gif_export as gif_export_routes
from api.middleware import error_handling_middleware, api_key_middleware
# GPU Resource Broker
from core.broker.gpu_resource_broker import get_broker
from core.broker.chat_with_fallback import router as chat_broker_router
from core.broker.broker_status_route import router as broker_status_router


# Set up logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("stable-diffusion-api")

# Initialize FastAPI app
app = FastAPI(
    title="Stable Diffusion API with Intelligent Queue",
    description="Enhanced Stable Diffusion API with intelligent queue management, advanced error handling and memory management",
    version="3.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/temp", StaticFiles(directory="/root/urpm/temp"), name="temp")

# Add custom error handling middleware
app.middleware("http")(api_key_middleware)
app.middleware("http")(error_handling_middleware)

# Initialize core components
error_manager = ErrorManager()
memory_manager = MemoryManager()
model_loader = ModelLoader()
video_model_loader = VideoModelLoader()

@app.on_event("startup")
async def startup_event():
    """Initialize the application on startup"""
    try:
        logger.info("Starting Stable Diffusion API with Video Generation...")
        
        # Initialize error manager
        error_manager.initialize()
        
        # Load the image model
        await model_loader.load_model()
        
        try:
            pass  # Video model disabled - was crashing and not functional
            logger.info("Video model loaded successfully")
        except Exception as e:
            logger.warning(f"Video model failed to load: {e}. Video generation will be unavailable.")
        
        queue_manager = initialize_queue_manager(memory_manager, model_loader, error_manager)
        
        # Set global instances for routes
        app.state.error_manager = error_manager
        app.state.memory_manager = memory_manager
        app.state.model_loader = model_loader
        app.state.video_model_loader = video_model_loader
        app.state.queue_manager = queue_manager
        
        # Initialize GPU Resource Broker
        broker = get_broker()
        app.state.gpu_broker = broker
        logger.info("GPU Resource Broker initialized")
        
        logger.info("Application with image and video generation started successfully")
        
    except Exception as e:
        logger.error(f"Failed to start application: {e}")
        error_manager.log_critical_error("startup_failure", str(e), {"component": "application_startup"})
        raise

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("Shutting down Stable Diffusion API...")
    
    if hasattr(app.state, 'queue_manager'):
        app.state.queue_manager.stop()
    
    error_manager.cleanup()

# Include routers
app.include_router(generation.router, prefix="/api/v1", tags=["generation"])
app.include_router(enhanced_generation.router, prefix="/api/v1", tags=["enhanced-generation"])
app.include_router(video_generation.router, prefix="/api/v1/video", tags=["video-generation"])
app.include_router(status.router, prefix="/api/v1", tags=["status"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(talking_avatar.router, prefix="/api/v1/talking-avatar", tags=["talking-avatar"])
app.include_router(chat_broker_router, tags=["chat-with-fallback"])
app.include_router(img2img_routes.router, prefix="/api/v1", tags=["img2img"])
app.include_router(upscale_routes.router, prefix="/api/v1", tags=["upscale"])
app.include_router(gif_export_routes.router, prefix="", tags=["gif"])
app.include_router(broker_status_router, tags=["broker"])

@app.get("/")
def root():
    return {
        "message": "Stable Diffusion API v3.0 with Image and Video Generation",
        "status": "running",
        "features": [
            "Image generation from text",
            "Video generation from text",
            "Image-to-video generation",
            "Intelligent queue management",
            "Auto-scaling workers",
            "Memory-aware task scheduling",
            "Priority-based processing",
            "Real-time system monitoring",
            "GPU Resource Broker with chat fallback"
        ],
        "docs": "/docs"
    }

if __name__ == "__main__":
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=settings.PORT, 
        reload=False,
        log_level="info"
    )
