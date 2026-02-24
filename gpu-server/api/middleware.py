import time
import logging
import os
import secrets
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

# Load .env file explicitly
load_dotenv()

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.DEBUG)

# API Key Configuration
API_KEY = os.environ.get("URPM_API_KEY", "")
ALLOWED_IPS = os.environ.get("ALLOWED_IPS", "").split(",") if os.environ.get("ALLOWED_IPS") else []

logger.info(f"[MIDDLEWARE] Loaded API_KEY: {'*' * 8 if API_KEY else 'NOT SET'}")
logger.info(f"[MIDDLEWARE] Loaded ALLOWED_IPS: {ALLOWED_IPS}")

# Paths that don't require authentication
PUBLIC_PATHS = ["/", "/docs", "/openapi.json", "/redoc", "/api/v1/status"]

def get_client_ip(request: Request) -> str:
    """Get the real client IP, handling proxies"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

async def api_key_middleware(request: Request, call_next):
    """API Key authentication middleware"""
    path = request.url.path
    client_ip = get_client_ip(request)
    
    logger.debug(f"[AUTH] Request: {request.method} {path} from {client_ip}")
    
    # Skip auth for public paths
    if any(path == p or (p.endswith("/") and path.startswith(p)) for p in PUBLIC_PATHS):
        logger.debug(f"[AUTH] Public path, skipping auth")
        return await call_next(request)
    
    # Check IP whitelist first (if configured)
    if ALLOWED_IPS and ALLOWED_IPS[0]:
        if client_ip in ALLOWED_IPS or any(ip.strip() == client_ip for ip in ALLOWED_IPS):
            logger.info(f"[AUTH] Whitelisted IP: {client_ip}")
            return await call_next(request)
    
    # Check API key
    if API_KEY:
        auth_header = request.headers.get("Authorization", "")
        api_key_header = request.headers.get("X-API-Key", "")
        
        # Support both Bearer token and X-API-Key header
        provided_key = ""
        if auth_header.startswith("Bearer "):
            provided_key = auth_header[7:]
        elif api_key_header:
            provided_key = api_key_header
        
        if not provided_key:
            logger.warning(f"[AUTH] DENIED - Missing API key from {client_ip} for {path}")
            return JSONResponse(
                status_code=401,
                content={"error": "API key required", "detail": "Provide API key via Authorization: Bearer <key> or X-API-Key header"}
            )
        
        if not secrets.compare_digest(provided_key, API_KEY):
            logger.warning(f"[AUTH] DENIED - Invalid API key from {client_ip} for {path}")
            return JSONResponse(
                status_code=403,
                content={"error": "Invalid API key", "detail": "The provided API key is not valid"}
            )
        
        logger.info(f"[AUTH] Valid API key from {client_ip}")
    else:
        logger.warning(f"[AUTH] API_KEY not set, allowing request")
    
    return await call_next(request)

async def error_handling_middleware(request: Request, call_next):
    """Global error handling middleware"""
    start_time = time.time()
    
    try:
        response = await call_next(request)
        duration = time.time() - start_time
        logger.info(f"{request.method} {request.url.path} - {response.status_code} - {duration:.2f}s")
        return response
        
    except HTTPException as e:
        logger.warning(f"HTTP Exception: {e.status_code} - {e.detail}")
        return JSONResponse(
            status_code=e.status_code,
            content={"error": e.detail, "status_code": e.status_code}
        )
        
    except Exception as e:
        logger.error(f"Unexpected error in {request.method} {request.url.path}: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": "Internal server error", "status_code": 500}
        )
