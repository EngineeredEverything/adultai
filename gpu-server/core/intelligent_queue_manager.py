import asyncio
import threading
import time
import uuid
import logging
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from enum import Enum
from collections import deque
from concurrent.futures import ThreadPoolExecutor
import torch

from core.config import settings

logger = logging.getLogger(__name__)

class QueuePriority(Enum):
    LOW = 1
    NORMAL = 2
    HIGH = 3
    CRITICAL = 4

class TaskStatus(Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

@dataclass
class QueueTask:
    id: str
    task_data: Dict[str, Any]
    priority: QueuePriority
    estimated_memory_gb: float
    estimated_time_seconds: float
    created_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    status: TaskStatus = TaskStatus.QUEUED
    error: Optional[str] = None
    result: Optional[Any] = None
    webhook_url: Optional[str] = None
    track_id: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 3

class IntelligentQueueManager:
    def __init__(self, memory_manager, model_loader, error_manager):
        self.memory_manager = memory_manager
        self.model_loader = model_loader
        self.error_manager = error_manager
        
        # Queue storage by priority
        self.queues = {
            QueuePriority.CRITICAL: deque(),
            QueuePriority.HIGH: deque(),
            QueuePriority.NORMAL: deque(),
            QueuePriority.LOW: deque()
        }
        
        # Active tasks tracking
        self.active_tasks: Dict[str, QueueTask] = {}
        self.completed_tasks: Dict[str, QueueTask] = {}
        self.task_history: deque = deque(maxlen=1000)
        
        # Queue statistics
        self.stats = {
            'total_processed': 0,
            'total_failed': 0,
            'average_processing_time': 0.0,
            'queue_throughput': 0.0,
            'memory_efficiency': 0.0
        }
        
        # Threading and processing
        self.executor = ThreadPoolExecutor(max_workers=settings.QUEUE_PARALLEL_WORKERS)
        self.processing_lock = threading.RLock()
        self.is_running = False
        self.processor_thread = None
        
        # Auto-scaling parameters
        self.current_workers = 1
        self.max_workers = settings.QUEUE_PARALLEL_WORKERS
        self.load_history = deque(maxlen=60)  # 1 minute of history
        
        logger.info(f"Initialized IntelligentQueueManager with {self.max_workers} max workers")

    def start(self):
        """Start the queue processing system"""
        if self.is_running:
            return
            
        self.is_running = True
        self.processor_thread = threading.Thread(target=self._process_queue_loop, daemon=True)
        self.processor_thread.start()
        logger.info("Queue processing system started")

    def stop(self):
        """Stop the queue processing system"""
        self.is_running = False
        if self.processor_thread:
            self.processor_thread.join(timeout=5)
        self.executor.shutdown(wait=True)
        logger.info("Queue processing system stopped")

    def add_task(self, task_data: Dict[str, Any], priority: Optional[QueuePriority] = None) -> str:
        """Add a new task to the queue with intelligent priority assignment"""
        task_id = str(uuid.uuid4())
        
        # Analyze task requirements
        estimated_memory, estimated_time = self._analyze_task_requirements(task_data)
        
        # Determine priority if not specified
        if priority is None:
            priority = self._determine_priority(task_data, estimated_memory, estimated_time)
        
        # Create task
        task = QueueTask(
            id=task_id,
            task_data=task_data,
            priority=priority,
            estimated_memory_gb=estimated_memory,
            estimated_time_seconds=estimated_time,
            webhook_url=task_data.get('webhook'),
            track_id=task_data.get('track_id')
        )
        
        # Check queue capacity
        total_queued = sum(len(q) for q in self.queues.values())
        if total_queued >= settings.QUEUE_MAX_SIZE:
            # Remove lowest priority tasks if queue is full
            self._remove_lowest_priority_task()
        
        # Add to appropriate queue
        with self.processing_lock:
            self.queues[priority].append(task)
            
        logger.info(f"Added task {task_id} to {priority.name} queue (memory: {estimated_memory:.2f}GB, time: {estimated_time:.1f}s)")
        return task_id

    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get comprehensive task status including queue information"""
        # Check active tasks
        if task_id in self.active_tasks:
            task = self.active_tasks[task_id]
            return self._format_task_status(task, include_queue_info=True)
        
        # Check completed tasks
        if task_id in self.completed_tasks:
            task = self.completed_tasks[task_id]
            return self._format_task_status(task, include_queue_info=False)
        
        # Check queued tasks
        with self.processing_lock:
            for priority, queue in self.queues.items():
                for i, task in enumerate(queue):
                    if task.id == task_id:
                        return self._format_task_status(task, queue_position=i+1, include_queue_info=True)
        
        return None

    def get_queue_status(self) -> Dict[str, Any]:
        """Get comprehensive queue system status"""
        with self.processing_lock:
            queue_lengths = {priority.name: len(queue) for priority, queue in self.queues.items()}
            total_queued = sum(queue_lengths.values())
            
            # Calculate estimated wait times
            estimated_wait_times = self._calculate_wait_times()
            
            # Get memory and system status
            memory_stats = self.memory_manager.get_memory_stats()
            
            # Calculate throughput
            current_time = time.time()
            recent_completions = [
                task for task in self.task_history 
                if task.completed_at and (current_time - task.completed_at) < 300  # Last 5 minutes
            ]
            throughput = len(recent_completions) / 5.0 if recent_completions else 0.0
            
            return {
                'queue_status': {
                    'total_queued': total_queued,
                    'by_priority': queue_lengths,
                    'active_tasks': len(self.active_tasks),
                    'completed_tasks': len(self.completed_tasks)
                },
                'estimated_wait_times': estimated_wait_times,
                'system_status': {
                    'current_workers': self.current_workers,
                    'max_workers': self.max_workers,
                    'memory_status': memory_stats.get('status', 'unknown'),
                    'memory_available_gb': memory_stats.get('free_gb', 0),
                    'throughput_per_minute': throughput * 60
                },
                'performance_stats': self.stats,
                'recommendations': self._get_performance_recommendations()
            }

    def cancel_task(self, task_id: str) -> bool:
        """Cancel a queued or active task"""
        # Check queued tasks
        with self.processing_lock:
            for priority, queue in self.queues.items():
                for i, task in enumerate(queue):
                    if task.id == task_id:
                        task.status = TaskStatus.CANCELLED
                        queue.remove(task)
                        self.completed_tasks[task_id] = task
                        logger.info(f"Cancelled queued task {task_id}")
                        return True
        
        # Check active tasks (mark for cancellation)
        if task_id in self.active_tasks:
            task = self.active_tasks[task_id]
            task.status = TaskStatus.CANCELLED
            logger.info(f"Marked active task {task_id} for cancellation")
            return True
        
        return False

    def _analyze_task_requirements(self, task_data: Dict[str, Any]) -> Tuple[float, float]:
        """Analyze task requirements for memory and time estimation"""
        height = task_data.get('height', 512)
        width = task_data.get('width', 512)
        samples = task_data.get('samples', 1)
        steps = task_data.get('num_inference_steps', 50)
        
        # Memory estimation
        estimated_memory = self.memory_manager.estimate_memory_requirement(height, width, samples, steps)
        
        # Time estimation based on historical data and complexity
        base_time = 30.0  # Base time for simple generation
        resolution_factor = (height * width) / (512 * 512)
        sample_factor = samples
        step_factor = steps / 50.0
        
        estimated_time = base_time * resolution_factor * sample_factor * step_factor
        
        # Adjust based on historical performance
        if self.stats['average_processing_time'] > 0:
            historical_factor = self.stats['average_processing_time'] / base_time
            estimated_time *= min(historical_factor, 3.0)  # Cap the adjustment
        
        return estimated_memory, estimated_time

    def _determine_priority(self, task_data: Dict[str, Any], memory_gb: float, time_seconds: float) -> QueuePriority:
        """Intelligently determine task priority based on requirements"""
        # High priority for low-resource tasks
        if memory_gb < settings.QUEUE_HIGH_PRIORITY_THRESHOLD and time_seconds < 60:
            return QueuePriority.HIGH
        
        # Critical priority for webhook tasks (real-time requirements)
        if task_data.get('webhook'):
            return QueuePriority.HIGH
        
        # Low priority for resource-intensive tasks
        if memory_gb > settings.QUEUE_MEMORY_THRESHOLD_GB or time_seconds > 180:
            return QueuePriority.LOW
        
        return QueuePriority.NORMAL

    def _process_queue_loop(self):
        """Main queue processing loop"""
        logger.info("Queue processing loop started")
        
        while self.is_running:
            try:
                # Update system load metrics
                self._update_load_metrics()
                
                # Auto-scale workers if enabled
                if settings.QUEUE_AUTO_SCALING:
                    self._auto_scale_workers()
                
                # Process tasks based on available resources
                self._process_available_tasks()
                
                # Cleanup completed tasks
                self._cleanup_old_tasks()
                
                # Update statistics
                self._update_statistics()
                
                time.sleep(1)  # Process every second
                
            except Exception as e:
                logger.error(f"Error in queue processing loop: {e}")
                self.error_manager.log_error("queue_processing_error", str(e), {})
                time.sleep(5)  # Wait longer on error

    def _process_available_tasks(self):
        """Process tasks based on available resources and workers"""
        if len(self.active_tasks) >= self.current_workers:
            return  # All workers busy
        
        memory_stats = self.memory_manager.get_memory_stats()
        # if memory_stats.get('status') == 'critical':
        #     logger.warning("Memory critical, pausing new task processing")
        #     return
        
        available_memory = memory_stats.get('free_gb', 0)
        
        # Get next task from highest priority queue
        task = self._get_next_task(available_memory)
        if not task:
            return
        
        # Start processing the task
        self._start_task_processing(task)

    def _get_next_task(self, available_memory: float) -> Optional[QueueTask]:
        """Get the next task that can fit in available memory"""
        with self.processing_lock:
            for priority in [QueuePriority.CRITICAL, QueuePriority.HIGH, QueuePriority.NORMAL, QueuePriority.LOW]:
                queue = self.queues[priority]
                
                # Find first task that fits in memory
                for i, task in enumerate(queue):
                    if task.estimated_memory_gb <= available_memory * settings.MEMORY_SAFETY_FACTOR:
                        queue.remove(task)
                        return task
                
                # If no task fits, try with reduced samples for normal/low priority
                if priority in [QueuePriority.NORMAL, QueuePriority.LOW]:
                    for i, task in enumerate(queue):
                        # Try to reduce samples to fit
                        original_samples = task.task_data.get('samples', 1)
                        if original_samples > 1:
                            max_samples = int(available_memory * settings.MEMORY_SAFETY_FACTOR / (task.estimated_memory_gb / original_samples))
                            if max_samples >= 1:
                                task.task_data['samples'] = max_samples
                                task.estimated_memory_gb = task.estimated_memory_gb * (max_samples / original_samples)
                                queue.remove(task)
                                logger.info(f"Reduced task {task.id} samples from {original_samples} to {max_samples}")
                                return task
        
        return None

    def _start_task_processing(self, task: QueueTask):
        """Start processing a task in a separate thread"""
        task.status = TaskStatus.PROCESSING
        task.started_at = time.time()
        self.active_tasks[task.id] = task
        
        # Submit to thread pool
        future = self.executor.submit(self._execute_task, task)
        future.add_done_callback(lambda f: self._task_completed(task, f))
        
        logger.info(f"Started processing task {task.id} (priority: {task.priority.name})")

    def _execute_task(self, task: QueueTask) -> Any:
        """Execute the actual task (image generation)"""
        try:
            # Import here to avoid circular imports
            from api.routes.generation import generate_image_task
            
            # Execute the generation task
            generate_image_task(
                task.id,
                task.task_data,
                self.error_manager,
                self.memory_manager,
                self.model_loader
            )
            
            return "success"
            
        except Exception as e:
            logger.error(f"Task {task.id} execution failed: {e}")
            raise

    def _task_completed(self, task: QueueTask, future):
        """Handle task completion"""
        try:
            result = future.result()
            task.status = TaskStatus.COMPLETED
            task.result = result
            task.completed_at = time.time()
            
            logger.info(f"Task {task.id} completed successfully in {task.completed_at - task.started_at:.2f}s")
            
        except Exception as e:
            task.status = TaskStatus.FAILED
            task.error = str(e)
            task.completed_at = time.time()
            
            # Retry logic
            if task.retry_count < task.max_retries:
                task.retry_count += 1
                task.status = TaskStatus.QUEUED
                task.started_at = None
                
                # Re-queue with lower priority
                lower_priority = QueuePriority.LOW if task.priority != QueuePriority.LOW else QueuePriority.LOW
                with self.processing_lock:
                    self.queues[lower_priority].append(task)
                
                logger.info(f"Re-queued task {task.id} for retry {task.retry_count}/{task.max_retries}")
                return
            
            logger.error(f"Task {task.id} failed permanently: {e}")
        
        finally:
            # Move to completed tasks
            if task.id in self.active_tasks:
                del self.active_tasks[task.id]
            self.completed_tasks[task.id] = task
            self.task_history.append(task)

    def _calculate_wait_times(self) -> Dict[str, float]:
        """Calculate estimated wait times for each priority queue"""
        wait_times = {}
        cumulative_time = 0.0
        
        # Calculate based on current active tasks and queue
        active_time = sum(
            task.estimated_time_seconds - (time.time() - task.started_at)
            for task in self.active_tasks.values()
            if task.started_at
        )
        cumulative_time = max(0, active_time / self.current_workers)
        
        for priority in [QueuePriority.CRITICAL, QueuePriority.HIGH, QueuePriority.NORMAL, QueuePriority.LOW]:
            queue = self.queues[priority]
            if queue:
                queue_time = sum(task.estimated_time_seconds for task in queue) / self.current_workers
                wait_times[priority.name] = cumulative_time + queue_time / 2  # Average wait time
                cumulative_time += queue_time
            else:
                wait_times[priority.name] = cumulative_time
        
        return wait_times

    def _format_task_status(self, task: QueueTask, queue_position: Optional[int] = None, include_queue_info: bool = False) -> Dict[str, Any]:
        """Format task status for API response"""
        status = {
            'id': task.id,
            'status': task.status.value,
            'priority': task.priority.name,
            'created_at': task.created_at,
            'estimated_memory_gb': task.estimated_memory_gb,
            'estimated_time_seconds': task.estimated_time_seconds
        }
        
        if task.started_at:
            status['started_at'] = task.started_at
            if task.status == TaskStatus.PROCESSING:
                status['processing_time'] = time.time() - task.started_at
        
        if task.completed_at:
            status['completed_at'] = task.completed_at
            status['total_time'] = task.completed_at - task.created_at
        
        if task.error:
            status['error'] = task.error
        
        if task.result:
            status['result'] = task.result
        
        if queue_position:
            status['queue_position'] = queue_position
        
        if include_queue_info:
            queue_status = self.get_queue_status()
            status['queue_info'] = {
                'total_queued': queue_status['queue_status']['total_queued'],
                'estimated_wait_time': queue_status['estimated_wait_times'].get(task.priority.name, 0),
                'system_load': len(self.active_tasks) / self.max_workers
            }
        
        return status

    def _update_load_metrics(self):
        """Update system load metrics for auto-scaling"""
        current_load = len(self.active_tasks) / self.max_workers
        total_queued = sum(len(q) for q in self.queues.values())
        queue_pressure = min(total_queued / settings.QUEUE_MAX_SIZE, 1.0)
        
        combined_load = (current_load + queue_pressure) / 2
        self.load_history.append(combined_load)

    def _auto_scale_workers(self):
        """Auto-scale workers based on load"""
        if len(self.load_history) < 10:
            return
        
        avg_load = sum(self.load_history) / len(self.load_history)
        
        # Scale up if consistently high load
        if avg_load > 0.8 and self.current_workers < self.max_workers:
            self.current_workers = min(self.current_workers + 1, self.max_workers)
            logger.info(f"Scaled up to {self.current_workers} workers (load: {avg_load:.2f})")
        
        # Scale down if consistently low load
        elif avg_load < 0.3 and self.current_workers > 1:
            self.current_workers = max(self.current_workers - 1, 1)
            logger.info(f"Scaled down to {self.current_workers} workers (load: {avg_load:.2f})")

    def _cleanup_old_tasks(self):
        """Clean up old completed tasks to prevent memory leaks"""
        current_time = time.time()
        cutoff_time = current_time - 3600  # Keep tasks for 1 hour
        
        to_remove = [
            task_id for task_id, task in self.completed_tasks.items()
            if task.completed_at and task.completed_at < cutoff_time
        ]
        
        for task_id in to_remove:
            del self.completed_tasks[task_id]

    def _update_statistics(self):
        """Update performance statistics"""
        if not self.task_history:
            return
        
        completed_tasks = [task for task in self.task_history if task.status == TaskStatus.COMPLETED]
        failed_tasks = [task for task in self.task_history if task.status == TaskStatus.FAILED]
        
        self.stats['total_processed'] = len(completed_tasks)
        self.stats['total_failed'] = len(failed_tasks)
        
        if completed_tasks:
            processing_times = [
                task.completed_at - task.started_at
                for task in completed_tasks
                if task.started_at and task.completed_at
            ]
            if processing_times:
                self.stats['average_processing_time'] = sum(processing_times) / len(processing_times)

    def _remove_lowest_priority_task(self):
        """Remove the oldest task from the lowest priority queue"""
        for priority in [QueuePriority.LOW, QueuePriority.NORMAL, QueuePriority.HIGH]:
            queue = self.queues[priority]
            if queue:
                removed_task = queue.popleft()
                logger.warning(f"Removed task {removed_task.id} from {priority.name} queue due to capacity")
                return

    def _get_performance_recommendations(self) -> List[str]:
        """Generate performance recommendations based on current metrics"""
        recommendations = []
        
        memory_stats = self.memory_manager.get_memory_stats()
        total_queued = sum(len(q) for q in self.queues.values())
        
        if memory_stats.get('status') == 'critical':
            recommendations.append("GPU memory is critically low. Consider reducing resolution or batch sizes.")
        
        if total_queued > settings.QUEUE_MAX_SIZE * 0.8:
            recommendations.append("Queue is nearly full. Consider scaling up resources or optimizing task parameters.")
        
        if self.stats['total_failed'] > self.stats['total_processed'] * 0.1:
            recommendations.append("High failure rate detected. Check system stability and resource allocation.")
        
        if len(self.active_tasks) == self.max_workers and total_queued > 10:
            recommendations.append("All workers busy with high queue load. Consider increasing parallel workers.")
        
        return recommendations

# Global queue manager instance
queue_manager = None

def get_queue_manager():
    """Get the global queue manager instance"""
    global queue_manager
    return queue_manager

def initialize_queue_manager(memory_manager, model_loader, error_manager):
    """Initialize the global queue manager"""
    global queue_manager
    queue_manager = IntelligentQueueManager(memory_manager, model_loader, error_manager)
    queue_manager.start()
    return queue_manager
