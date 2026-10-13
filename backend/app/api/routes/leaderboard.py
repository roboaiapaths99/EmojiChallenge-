from typing import Optional
from fastapi import APIRouter, Query
from app.schemas.leaderboard import LeaderboardResponse
from app.services.leaderboard_service import leaderboard_service

router = APIRouter(tags=["Leaderboard"])


@router.get("/events/{event_id}/leaderboard", response_model=LeaderboardResponse)
@router.get("/leaderboard", response_model=LeaderboardResponse)
async def get_leaderboard(
    event_id: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100)
):
    """
    GET /api/events/{event_id}/leaderboard - Get leaderboard rankings for event.
    """
    return await leaderboard_service.get_leaderboard(event_id, limit)
