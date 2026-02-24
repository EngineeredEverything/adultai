import requests
import time
import logging
from typing import Dict, Any
from core.config import settings

logger = logging.getLogger(__name__)

def send_webhook(webhook_url: str, data: Dict[str, Any], max_retries: int = None) -> bool:
    """Enhanced webhook sender with retry logic and error tracking"""
    if not webhook_url:
        return True
    
    max_retries = max_retries or settings.WEBHOOK_MAX_RETRIES
    
    for attempt in range(max_retries):
        try:
            logger.debug(f"Sending webhook (attempt {attempt + 1}/{max_retries}) to {webhook_url}")
            
            response = requests.post(
                webhook_url, 
                json=data, 
                headers={"Content-Type": "application/json"},
                timeout=settings.WEBHOOK_TIMEOUT
            )
            
            if response.status_code == 200:
                logger.debug(f"Webhook sent successfully: {response.status_code}")
                return True
            else:
                logger.warning(f"Webhook returned status {response.status_code}: {response.text}")
                
        except requests.exceptions.ConnectionError as e:
            logger.warning(f"Webhook connection failed (attempt {attempt + 1}): {e}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)  # Exponential backoff
        except requests.exceptions.Timeout as e:
            logger.warning(f"Webhook timeout (attempt {attempt + 1}): {e}")
        except Exception as e:
            logger.error(f"Unexpected webhook error (attempt {attempt + 1}): {e}")
    
    logger.error(f"Failed to send webhook after {max_retries} attempts")
    return False
