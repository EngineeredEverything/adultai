import logging
from fastapi import APIRouter, Request, HTTPException, Query
from typing import Optional

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/errors")
async def get_errors(
    req: Request,
    limit: int = Query(50, ge=1, le=200),
    error_type: Optional[str] = None
):
    """Get error logs for admin review"""
    try:
        error_manager = req.app.state.error_manager
        
        if error_type:
            # Filter by error type (this would need to be implemented in ErrorManager)
            errors = error_manager.get_critical_errors(limit)
            filtered_errors = [e for e in errors if e.get("type") == error_type]
            return {
                "errors": filtered_errors,
                "total": len(filtered_errors),
                "filtered_by": error_type
            }
        else:
            errors = error_manager.get_critical_errors(limit)
            return {
                "errors": errors,
                "total": len(errors)
            }
            
    except Exception as e:
        logger.error(f"Error getting admin errors: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/errors/summary")
async def get_error_summary(req: Request):
    """Get error summary statistics"""
    try:
        error_manager = req.app.state.error_manager
        return error_manager.get_error_summary()
        
    except Exception as e:
        logger.error(f"Error getting error summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/errors/{error_id}")
async def get_error_details(req: Request, error_id: str):
    """Get detailed information about a specific error"""
    try:
        error_manager = req.app.state.error_manager
        error_details = error_manager.get_error_details(error_id)
        
        if not error_details:
            raise HTTPException(status_code=404, detail="Error not found")
        
        return error_details
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting error details: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/errors/{error_type}")
async def clear_error_history(req: Request, error_type: str):
    """Clear error history for a specific error type"""
    try:
        error_manager = req.app.state.error_manager
        error_manager.clear_error_history(error_type)
        
        return {"message": f"Cleared error history for type: {error_type}"}
        
    except Exception as e:
        logger.error(f"Error clearing error history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/errors")
async def clear_all_errors(req: Request):
    """Clear all error history"""
    try:
        error_manager = req.app.state.error_manager
        error_manager.clear_error_history()
        
        return {"message": "Cleared all error history"}
        
    except Exception as e:
        logger.error(f"Error clearing all errors: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tasks/stats")
async def get_task_stats(req: Request):
    """Get task statistics"""
    try:
        from core.task_manager import task_manager
        return task_manager.get_stats()
        
    except Exception as e:
        logger.error(f"Error getting task stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/maintenance/cleanup")
async def run_maintenance(req: Request):
    """Run maintenance tasks"""
    try:
        from core.task_manager import task_manager
        
        # Cleanup old tasks
        task_manager.cleanup_old_tasks()
        
        # Clear memory
        memory_manager = req.app.state.memory_manager
        memory_manager.clear_memory()
        
        return {"message": "Maintenance completed successfully"}
        
    except Exception as e:
        logger.error(f"Error running maintenance: {e}")
        raise HTTPException(status_code=500, detail=str(e))
