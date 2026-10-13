from typing import List, Optional, Dict, Any
from app.core.database import get_db
from app.schemas.leaderboard import LeaderboardEntry, LeaderboardResponse


class LeaderboardService:
    """Service aggregating event leaderboard rankings."""

    @property
    def session_collection(self):
        return get_db()["game_sessions"]

    async def get_leaderboard(self, event_id: Optional[str] = None, limit: int = 20) -> LeaderboardResponse:
        filter_dict: Dict[str, Any] = {"status": "completed"}
        if event_id:
            filter_dict["eventId"] = event_id

        cursor = await self.session_collection.find(
            filter=filter_dict,
            sort=[("finalScore", -1)],
            limit=limit
        )
        sessions = await cursor.to_list(limit)

        entries = []
        for i, s in enumerate(sessions):
            entries.append(
                LeaderboardEntry(
                    rank=i + 1,
                    sessionId=s.get("id"),
                    displayName=f"Player {s.get('id', '')[-4:]}",
                    score=float(s.get("finalScore", 0)),
                    mode=s.get("mode", "single"),
                    createdAt=s.get("createdAt", "")
                )
            )

        total = await self.session_collection.count_documents(filter_dict)
        return LeaderboardResponse(eventId=event_id, entries=entries, total=total)


leaderboard_service = LeaderboardService()
