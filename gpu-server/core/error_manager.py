import json
import os
import time
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from collections import defaultdict, deque
import logging
from pathlib import Path

from core.config import settings

logger = logging.getLogger(__name__)

class ErrorManager:
    def __init__(self):
        self.error_log_dir = Path(settings.ERROR_LOG_DIR)
        self.error_counts = defaultdict(int)
        self.error_timestamps = defaultdict(deque)
        self.critical_errors = []
        self.lock = threading.Lock()
        
        # Error types that should trigger cache clearing
        self.cache_clear_triggers = {
            "cuda_out_of_memory",
            "memory_allocation_failed",
            "model_loading_error",
            "generation_timeout"
        }
        
        # Error types that are considered critical for admins
        self.critical_error_types = {
            "cuda_out_of_memory",
            "model_loading_error",
            "startup_failure",
            "webhook_total_failure",
            "disk_space_critical",
            "memory_leak_detected"
        }
    
    def initialize(self):
        """Initialize error manager"""
        try:
            # Create error log directory
            self.error_log_dir.mkdir(parents=True, exist_ok=True)
            
            # Load existing error logs
            self._load_existing_errors()
            
            logger.info(f"Error manager initialized. Log directory: {self.error_log_dir}")
            
        except Exception as e:
            logger.error(f"Failed to initialize error manager: {e}")
    
    def _load_existing_errors(self):
        """Load existing error logs from disk"""
        try:
            error_files = list(self.error_log_dir.glob("*.json"))
            error_files.sort(key=lambda x: x.stat().st_mtime, reverse=True)
            
            # Load recent critical errors
            for error_file in error_files[:100]:  # Load last 100 error files
                try:
                    with open(error_file, 'r') as f:
                        error_data = json.load(f)
                        if error_data.get('is_critical'):
                            self.critical_errors.append(error_data)
                except Exception as e:
                    logger.warning(f"Failed to load error file {error_file}: {e}")
            
            # Keep only recent critical errors
            self.critical_errors = self.critical_errors[:50]
            
        except Exception as e:
            logger.error(f"Failed to load existing errors: {e}")
    
    def is_error_looping(self, error_type: str) -> bool:
        """Check if an error is looping (occurring too frequently)"""
        with self.lock:
            now = time.time()
            window_start = now - (settings.ERROR_LOOP_WINDOW_MINUTES * 60)
            
            # Clean old timestamps
            timestamps = self.error_timestamps[error_type]
            while timestamps and timestamps[0] < window_start:
                timestamps.popleft()
            
            # Check if error count exceeds threshold
            return len(timestamps) >= settings.ERROR_LOOP_THRESHOLD
    
    def log_error(self, error_type: str, error_message: str, context: Dict[str, Any] = None, task_id: str = None):
        """Log an error with context and determine if action is needed"""
        try:
            with self.lock:
                now = time.time()
                
                # Check for error looping
                if self.is_error_looping(error_type):
                    logger.warning(f"Error loop detected for {error_type}. Skipping logging.")
                    return False
                
                # Add timestamp to tracking
                self.error_timestamps[error_type].append(now)
                self.error_counts[error_type] += 1
                
                # Create error data
                error_data = {
                    "id": f"{error_type}_{int(now)}",
                    "type": error_type,
                    "message": error_message,
                    "timestamp": datetime.now().isoformat(),
                    "context": context or {},
                    "task_id": task_id,
                    "count": self.error_counts[error_type],
                    "is_critical": error_type in self.critical_error_types
                }
                
                # Save to file if critical or first occurrence
                if error_data["is_critical"] or self.error_counts[error_type] == 1:
                    self._save_error_to_file(error_data)
                
                # Add to critical errors list if critical
                if error_data["is_critical"]:
                    self.critical_errors.append(error_data)
                    # Keep only recent critical errors
                    self.critical_errors = self.critical_errors[-50:]
                
                # Trigger cache clear if needed
                if error_type in self.cache_clear_triggers:
                    self._trigger_cache_clear(error_type)
                
                logger.error(f"Error logged: {error_type} - {error_message}")
                return True
                
        except Exception as e:
            logger.error(f"Failed to log error: {e}")
            return False
    
    def log_critical_error(self, error_type: str, error_message: str, context: Dict[str, Any] = None):
        """Log a critical error that admins should know about"""
        # Force it to be critical
        if error_type not in self.critical_error_types:
            self.critical_error_types.add(error_type)
        
        return self.log_error(error_type, error_message, context)
    
    def _save_error_to_file(self, error_data: Dict[str, Any]):
        """Save error data to JSON file"""
        try:
            filename = f"{error_data['type']}_{error_data['timestamp'].replace(':', '-')}.json"
            filepath = self.error_log_dir / filename
            
            with open(filepath, 'w') as f:
                json.dump(error_data, f, indent=2)
            
            # Clean up old error files
            self._cleanup_old_error_files()
            
        except Exception as e:
            logger.error(f"Failed to save error to file: {e}")
    
    def _cleanup_old_error_files(self):
        """Remove old error files to prevent disk space issues"""
        try:
            error_files = list(self.error_log_dir.glob("*.json"))
            if len(error_files) > settings.MAX_ERROR_LOGS:
                # Sort by modification time and remove oldest
                error_files.sort(key=lambda x: x.stat().st_mtime)
                files_to_remove = error_files[:-settings.MAX_ERROR_LOGS]
                
                for file_path in files_to_remove:
                    file_path.unlink()
                    
                logger.info(f"Cleaned up {len(files_to_remove)} old error files")
                
        except Exception as e:
            logger.error(f"Failed to cleanup old error files: {e}")
    
    def _trigger_cache_clear(self, error_type: str):
        """Trigger cache clearing for specific error types"""
        try:
            from core.memory_manager import MemoryManager
            
            logger.info(f"Triggering cache clear due to error: {error_type}")
            memory_manager = MemoryManager()
            success = memory_manager.clear_memory()
            
            if success:
                logger.info("Cache cleared successfully after error")
            else:
                logger.warning("Failed to clear cache after error")
                
        except Exception as e:
            logger.error(f"Failed to trigger cache clear: {e}")
    
    def get_error_summary(self) -> Dict[str, Any]:
        """Get summary of errors"""
        with self.lock:
            return {
                "total_error_types": len(self.error_counts),
                "error_counts": dict(self.error_counts),
                "critical_errors_count": len(self.critical_errors),
                "recent_critical_errors": self.critical_errors[-10:] if self.critical_errors else []
            }
    
    def get_critical_errors(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get critical errors for admin review"""
        with self.lock:
            return self.critical_errors[-limit:] if self.critical_errors else []
    
    def get_error_details(self, error_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed information about a specific error"""
        try:
            # Search in memory first
            for error in self.critical_errors:
                if error.get("id") == error_id:
                    return error
            
            # Search in files
            for error_file in self.error_log_dir.glob("*.json"):
                try:
                    with open(error_file, 'r') as f:
                        error_data = json.load(f)
                        if error_data.get("id") == error_id:
                            return error_data
                except Exception:
                    continue
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to get error details: {e}")
            return None
    
    def clear_error_history(self, error_type: str = None):
        """Clear error history for a specific type or all errors"""
        try:
            with self.lock:
                if error_type:
                    # Clear specific error type
                    if error_type in self.error_counts:
                        del self.error_counts[error_type]
                    if error_type in self.error_timestamps:
                        del self.error_timestamps[error_type]
                    
                    # Remove from critical errors
                    self.critical_errors = [
                        e for e in self.critical_errors 
                        if e.get("type") != error_type
                    ]
                    
                    logger.info(f"Cleared error history for type: {error_type}")
                else:
                    # Clear all errors
                    self.error_counts.clear()
                    self.error_timestamps.clear()
                    self.critical_errors.clear()
                    
                    logger.info("Cleared all error history")
                    
        except Exception as e:
            logger.error(f"Failed to clear error history: {e}")
    
    def cleanup(self):
        """Cleanup resources"""
        try:
            # Save current state if needed
            logger.info("Error manager cleanup completed")
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
