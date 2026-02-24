import uuid
import time
import threading
import math
from typing import Dict, List, Optional, Any
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)

class TaskManager:
    def __init__(self):
        self.tasks: Dict[str, Dict[str, Any]] = {}
        self.lock = threading.Lock()
        self.task_history = defaultdict(list)  # Track task history per user/session
    
    def create_task(self, task_data: dict, user_id: str = None) -> str:
        """Create a new task with tracking"""
        task_id = str(uuid.uuid4())
        
        with self.lock:
            self.tasks[task_id] = {
                "id": task_id,
                "status": "processing",
                "data": task_data,
                "output": [],
                "created_at": time.time(),
                "eta": self._calculate_eta(task_data),
                "error": None,
                "user_id": user_id,
                "progress": 0
            }
            
            # Add to user history
            if user_id:
                self.task_history[user_id].append(task_id)
                # Keep only recent tasks
                self.task_history[user_id] = self.task_history[user_id][-50:]
        
        return task_id
    
    def _calculate_eta(self, task_data: dict) -> int:
        """Calculate estimated time in seconds based on parameters"""
        try:
            base_time = 3  # Base seconds per step
            steps = task_data.get("num_inference_steps", 50)
            samples = task_data.get("samples", 1)
            
            width = task_data.get("width", 512)
            height = task_data.get("height", 512)
            resolution_factor = (width * height) / (512 * 512)
            
            eta = math.ceil(base_time * steps * samples * resolution_factor)
            return max(eta, 10)  # Minimum 10 seconds
            
        except Exception as e:
            logger.error(f"Error calculating ETA: {e}")
            return 60  # Default 1 minute
    
    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get task by ID"""
        with self.lock:
            return self.tasks.get(task_id)
    
    def update_task(self, task_id: str, status: str = None, output: Optional[List[str]] = None, 
                   error: Optional[str] = None, progress: Optional[int] = None):
        """Update task status and data"""
        with self.lock:
            if task_id in self.tasks:
                if status:
                    self.tasks[task_id]["status"] = status
                if output:
                    self.tasks[task_id]["output"] = output
                if error:
                    self.tasks[task_id]["error"] = error
                if progress is not None:
                    self.tasks[task_id]["progress"] = progress
                
                # Update timestamp for completed tasks
                if status in ["success", "failed", "cancelled"]:
                    self.tasks[task_id]["completed_at"] = time.time()
    
    def get_user_tasks(self, user_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Get tasks for a specific user"""
        with self.lock:
            task_ids = self.task_history.get(user_id, [])
            tasks = []
            
            for task_id in reversed(task_ids[-limit:]):
                if task_id in self.tasks:
                    tasks.append(self.tasks[task_id])
            
            return tasks
    
    def cleanup_old_tasks(self, max_age_hours: int = 24):
        """Remove old completed tasks"""
        try:
            current_time = time.time()
            cutoff_time = current_time - (max_age_hours * 3600)
            
            with self.lock:
                tasks_to_remove = []
                
                for task_id, task in self.tasks.items():
                    # Remove old completed tasks
                    if (task.get("status") in ["success", "failed", "cancelled"] and 
                        task.get("completed_at", 0) < cutoff_time):
                        tasks_to_remove.append(task_id)
                    # Remove very old processing tasks (likely stuck)
                    elif (task.get("status") == "processing" and 
                          task.get("created_at", 0) < cutoff_time):
                        tasks_to_remove.append(task_id)
                
                for task_id in tasks_to_remove:
                    del self.tasks[task_id]
                
                if tasks_to_remove:
                    logger.info(f"Cleaned up {len(tasks_to_remove)} old tasks")
                    
        except Exception as e:
            logger.error(f"Error cleaning up old tasks: {e}")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get task statistics"""
        with self.lock:
            total_tasks = len(self.tasks)
            status_counts = defaultdict(int)
            
            for task in self.tasks.values():
                status_counts[task["status"]] += 1
            
            return {
                "total_tasks": total_tasks,
                "status_counts": dict(status_counts),
                "active_users": len(self.task_history)
            }

# Global task manager instance
task_manager = TaskManager()
