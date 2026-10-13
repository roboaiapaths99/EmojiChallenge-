import hashlib
import secrets
from typing import Optional
from fastapi import Header, HTTPException, status
from app.core.config import settings


def hash_token(token: str) -> str:
    """Generate SHA-256 hash of token to match existing Node.js behavior."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_plain_token(num_bytes: int = 16) -> str:
    """Generate cryptographically secure hexadecimal token."""
    return secrets.token_hex(num_bytes)


def verify_admin_secret(x_admin_secret: Optional[str] = Header(None)) -> bool:
    """Verify admin secret for protected administrative endpoints."""
    # Allow in development environment if header is omitted
    if not settings.ADMIN_SECRET or (settings.APP_ENV == "development" and not x_admin_secret):
        return True
    if not x_admin_secret or x_admin_secret != settings.ADMIN_SECRET:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing admin authentication credentials"
        )
    return True
