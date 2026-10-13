import time
from typing import Optional, Dict, Any, List, Tuple
from app.core.database import get_db
from app.core.security import hash_token, generate_plain_token
from app.core.config import settings
from app.utils.helpers import utc_now_iso, generate_id, current_time_ms
from app.services.storage_service import storage_service
from app.core.logging import logger


class PhotoService:
    """Service handling souvenir photos, secure tokens, and recipient claiming."""

    @property
    def photo_collection(self):
        return get_db()["photos"]

    @property
    def recipient_collection(self):
        return get_db()["photo_recipients"]

    @property
    def session_collection(self):
        return get_db()["game_sessions"]

    async def create_photo(self, session_id: str, filename: str) -> Tuple[Dict[str, Any], str]:
        """Create a photo record with a cryptographically secure token and SHA-256 hash."""
        photo_id = generate_id("photo")
        plain_token = generate_plain_token(16)
        token_hash = hash_token(plain_token)
        ttl_ms = settings.PHOTO_EXPIRY_MINUTES * 60 * 1000
        expires_at = current_time_ms() + ttl_ms

        photo_doc = {
            "id": photo_id,
            "sessionId": session_id,
            "storageKey": filename,
            "tokenHash": token_hash,
            "plainToken": plain_token,
            "expiresAt": expires_at,
            "status": "ready",
            "emojiPhotos": [],
            "createdAt": utc_now_iso(),
        }

        await self.photo_collection.insert_one(photo_doc)
        logger.info("Created photo '%s' for session '%s' with token hash", photo_id, session_id)
        return photo_doc, plain_token

    async def update_photo(self, photo_id: str, updates: Dict[str, Any]) -> None:
        await self.photo_collection.update_one({"id": photo_id}, {"$set": updates})

    async def get_photo_by_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Look up photo by plaintext token via SHA-256 hash, verifying expiration."""
        token_hash = hash_token(token.strip())
        photo = await self.photo_collection.find_one({"tokenHash": token_hash})
        if not photo:
            return None

        # Check expiration
        now_ms = current_time_ms()
        if now_ms > photo.get("expiresAt", 0):
            if photo.get("status") != "expired":
                await self.photo_collection.update_one(
                    {"id": photo["id"]},
                    {"$set": {"status": "expired"}}
                )
            logger.info("Photo token for '%s' has expired", photo["id"])
            return None

        return photo

    async def get_photo_by_id(self, photo_id: str) -> Optional[Dict[str, Any]]:
        return await self.photo_collection.find_one({"id": photo_id})

    async def list_recent_photos(self, limit: int = 20) -> List[Dict[str, Any]]:
        cursor = await self.photo_collection.find(sort=[("createdAt", -1)], limit=limit)
        photos = await cursor.to_list(limit)

        # Attach sessions
        result = []
        for p in photos:
            session = await self.session_collection.find_one({"id": p.get("sessionId")})
            p_copy = dict(p)
            p_copy["session"] = session
            result.append(p_copy)
        return result

    async def add_recipient(self, photo_id: str, name: str, mobile: str, email: Optional[str] = None) -> Dict[str, Any]:
        recipient_id = generate_id("rec")
        photo = await self.photo_collection.find_one({"id": photo_id})
        session_id = photo.get("sessionId") if photo else None
        score = 0
        mode = "single"
        if session_id:
            sess = await self.session_collection.find_one({"id": session_id})
            if sess:
                score = sess.get("finalScore", 0)
                mode = sess.get("mode", "single")

        recipient_doc = {
            "id": recipient_id,
            "photoId": photo_id,
            "sessionId": session_id,
            "name": name.strip(),
            "mobile": mobile.strip(),
            "email": email.strip() if email else None,
            "score": score,
            "mode": mode,
            "isReal": True,
            "createdAt": utc_now_iso(),
            "downloadedAt": None,
        }
        await self.recipient_collection.insert_one(recipient_doc)
        logger.info("Registered authentic recipient '%s' for photo '%s'", recipient_id, photo_id)
        return recipient_doc

    async def mark_downloaded(self, recipient_id: str) -> None:
        await self.recipient_collection.update_one(
            {"id": recipient_id},
            {"$set": {"downloadedAt": utc_now_iso()}}
        )

    async def get_recipients_for_photo(self, photo_id: str) -> List[Dict[str, Any]]:
        cursor = await self.recipient_collection.find({"photoId": photo_id})
        return await cursor.to_list()


photo_service = PhotoService()
