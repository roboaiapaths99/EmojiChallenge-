from typing import List, Optional
from pydantic import BaseModel


class LeaderboardEntry(BaseModel):
    rank: int
    sessionId: str
    displayName: str
    score: float
    mode: str
    createdAt: str


class LeaderboardResponse(BaseModel):
    eventId: Optional[str] = None
    entries: List[LeaderboardEntry]
    total: int
