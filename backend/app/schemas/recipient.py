from typing import Optional
from pydantic import BaseModel, Field, EmailStr


class ClaimRecipientRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    mobile: str = Field(..., min_length=8, max_length=20)
    email: Optional[str] = None


class ClaimRecipientResponse(BaseModel):
    success: bool = True
    recipientId: str
    downloadUrl: str
