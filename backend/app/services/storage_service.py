import os
from pathlib import Path
from typing import Optional, Tuple
from app.core.config import settings
from app.core.logging import logger


class StorageService:
    """Storage abstraction for saving and retrieving souvenir photos."""

    def __init__(self):
        self.provider = settings.STORAGE_PROVIDER
        self.local_dir = settings.UPLOADS_PATH

    async def save_photo(self, filename: str, content: bytes) -> str:
        """Save photo content to storage provider and return storage key."""
        try:
            self.local_dir.mkdir(parents=True, exist_ok=True)
            target_path = self.local_dir / filename
            with open(target_path, "wb") as f:
                f.write(content)
            logger.info("Saved photo '%s' (%d bytes) to local storage", filename, len(content))
            return filename
        except Exception as e:
            logger.error("Failed to write photo '%s': %s", filename, e)
            raise e

    def get_photo_path(self, storage_key: str) -> Optional[Path]:
        """Return Path to local photo file if it exists."""
        target_path = self.local_dir / storage_key
        if target_path.exists() and target_path.is_file():
            return target_path
        return None

    async def read_photo_bytes(self, storage_key: str) -> Optional[bytes]:
        """Read bytes of photo file from storage."""
        target_path = self.get_photo_path(storage_key)
        if target_path:
            with open(target_path, "rb") as f:
                return f.read()
        return None

    async def delete_photo(self, storage_key: str) -> bool:
        """Delete photo from storage."""
        target_path = self.get_photo_path(storage_key)
        if target_path:
            try:
                os.remove(target_path)
                return True
            except OSError as e:
                logger.error("Failed to delete photo '%s': %s", storage_key, e)
        return False


storage_service = StorageService()
