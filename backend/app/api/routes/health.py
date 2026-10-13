from fastapi import APIRouter
from app.core.database import get_db

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check():
    """Health check endpoint providing service and database status."""
    db = get_db()
    db_status = "connected" if db is not None else "disconnected"
    return {
        "status": "ok",
        "service": "emoji-face-challenge-api",
        "database": db_status
    }
