import re
from fastapi import HTTPException, status, UploadFile

ALLOWED_IMAGE_MIME_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp"
}

MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024  # 15 MB limit


def validate_image_file(file: UploadFile, content: bytes) -> None:
    """Validate uploaded photo file MIME type and size."""
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded photo file is empty"
        )

    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Uploaded photo exceeds maximum allowed size ({MAX_FILE_SIZE_BYTES // (1024*1024)}MB)"
        )

    # Basic MIME check
    content_type = file.content_type.lower() if file.content_type else "image/jpeg"
    if content_type not in ALLOWED_IMAGE_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{content_type}'. Allowed types: JPEG, PNG, WEBP"
        )


def validate_mobile(mobile: str) -> str:
    cleaned = mobile.strip()
    if not cleaned or len(cleaned) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mobile number is required and must be at least 8 digits"
        )
    return cleaned


def validate_name(name: str) -> str:
    cleaned = name.strip()
    if not cleaned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Name is required"
        )
    return cleaned
