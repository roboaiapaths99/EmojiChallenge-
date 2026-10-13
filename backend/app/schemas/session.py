from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field


class CreateSessionRequest(BaseModel):
    id: Optional[str] = None
    sessionId: Optional[str] = None
    eventId: Optional[str] = None
    mode: str = Field(default="single", pattern="^(single|two)$")
    playerName: Optional[str] = "Challenger"
    players: Optional[List[Dict[str, Any]]] = None
    rounds: Optional[List[Dict[str, Any]]] = None
    p1Score: Optional[float] = 0.0
    p2Score: Optional[float] = 0.0
    finalScore: Optional[float] = 0.0
    scores: Optional[Dict[str, float]] = None


class SessionResultSubmission(BaseModel):
    roundResults: Optional[List[Dict[str, Any]]] = []
    scores: Optional[Dict[str, float]] = None
    finalScore: Optional[float] = 0.0


class StoredSessionSchema(BaseModel):
    id: str
    eventId: Optional[str] = None
    mode: str
    playerName: Optional[str] = "Challenger"
    players: List[Dict[str, Any]] = []
    rounds: List[Dict[str, Any]] = []
    p1Score: float = 0.0
    p2Score: float = 0.0
    finalScore: float = 0.0
    status: str = "completed"
    photoId: Optional[str] = None
    createdAt: str


class SessionResponse(BaseModel):
    success: bool = True
    session: StoredSessionSchema
