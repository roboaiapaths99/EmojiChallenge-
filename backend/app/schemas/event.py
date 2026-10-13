from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class EventTheme(BaseModel):
    primary: str = "#FFCC00"
    background: str = "#1E1E2F"
    accent: str = "#FF4081"


class EventGameConfig(BaseModel):
    enabledModes: List[str] = ["single", "two"]
    rounds: Dict[str, Any] = {}
    emojiProfiles: List[Dict[str, Any]] = []
    photo: Dict[str, Any] = {"enabled": True, "expiryMinutes": 60}
    leaderboard: Dict[str, Any] = {"enabled": True}


class EventCreateRequest(BaseModel):
    id: Optional[str] = None
    name: str = Field(..., min_length=1, max_length=150)
    logo: Optional[str] = None
    theme: Optional[EventTheme] = EventTheme()
    active: bool = True
    gameConfig: Optional[EventGameConfig] = EventGameConfig()


class EventResponse(BaseModel):
    id: str
    name: str
    logo: Optional[str] = None
    theme: Dict[str, Any]
    active: bool
    gameConfig: Dict[str, Any]
    createdAt: str
    updatedAt: str
