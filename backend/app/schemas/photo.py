from typing import Optional, List, Dict, Any
from pydantic import BaseModel


class PhotoUploadResponse(BaseModel):
    success: bool = True
    photoId: str
    token: str
    expiresAt: int
    previewUrl: str
    claimUrl: str


class SessionSummaryInPhoto(BaseModel):
    mode: str
    p1Score: float
    p2Score: float
    finalScore: float
    rounds: Optional[List[Dict[str, Any]]] = None
    createdAt: Optional[str] = None


class PhotoDetailsResponse(BaseModel):
    success: bool = True
    photoId: str
    previewUrl: str
    expiresAt: int
    session: Optional[SessionSummaryInPhoto] = None


class RecentPhotoItem(BaseModel):
    id: str
    plainToken: str
    createdAt: str
    expiresAt: int
    previewUrl: str
    claimUrl: str
    session: Optional[Dict[str, Any]] = None


class RecentPhotosResponse(BaseModel):
    success: bool = True
    photos: List[RecentPhotoItem]
