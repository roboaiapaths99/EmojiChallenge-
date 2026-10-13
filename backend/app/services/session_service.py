from typing import Optional, Dict, Any, List
from app.core.database import get_db
from app.utils.helpers import utc_now_iso, generate_id
from app.schemas.session import CreateSessionRequest, SessionResultSubmission
from app.core.logging import logger


class SessionService:
    """Service handling game session lifecycle and idempotency."""

    @property
    def collection(self):
        return get_db()["game_sessions"]

    async def create_or_upsert_session(self, payload: CreateSessionRequest) -> Dict[str, Any]:
        """Create a new session or update existing one idempotently."""
        session_id = payload.id or payload.sessionId or generate_id("sess")

        existing = await self.collection.find_one({"id": session_id})
        p1 = payload.p1Score if payload.p1Score is not None else (payload.scores.get("p1", 0.0) if payload.scores else 0.0)
        p2 = payload.p2Score if payload.p2Score is not None else (payload.scores.get("p2", 0.0) if payload.scores else 0.0)
        final_score = payload.finalScore if payload.finalScore is not None else max(p1, p2)

        session_data = {
            "id": session_id,
            "eventId": payload.eventId,
            "mode": payload.mode or "single",
            "playerName": payload.playerName or "Challenger",
            "players": payload.players or [],
            "rounds": payload.rounds or [],
            "p1Score": float(p1),
            "p2Score": float(p2),
            "finalScore": float(final_score),
            "status": "completed",
        }

        if existing:
            # Update existing session
            update_data = {k: v for k, v in session_data.items() if k != "id"}
            await self.collection.update_one({"id": session_id}, {"$set": update_data})
            existing.update(update_data)
            logger.info("Updated existing game session '%s'", session_id)
            return existing
        else:
            session_data["createdAt"] = utc_now_iso()
            session_data["photoId"] = None
            await self.collection.insert_one(session_data)
            logger.info("Created new game session '%s'", session_id)
            return session_data

    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        return await self.collection.find_one({"id": session_id})

    async def update_session_results(self, session_id: str, results: SessionResultSubmission) -> Optional[Dict[str, Any]]:
        session = await self.get_session(session_id)
        if not session:
            return None

        p1 = results.scores.get("p1", session.get("p1Score", 0.0)) if results.scores else session.get("p1Score", 0.0)
        p2 = results.scores.get("p2", session.get("p2Score", 0.0)) if results.scores else session.get("p2Score", 0.0)
        final_score = results.finalScore if results.finalScore is not None else max(p1, p2)

        update = {
            "rounds": results.roundResults or session.get("rounds", []),
            "p1Score": float(p1),
            "p2Score": float(p2),
            "finalScore": float(final_score),
            "status": "completed",
            "completedAt": utc_now_iso()
        }
        await self.collection.update_one({"id": session_id}, {"$set": update})
        session.update(update)
        return session

    async def complete_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        session = await self.get_session(session_id)
        if not session:
            return None
        update = {"status": "completed", "completedAt": utc_now_iso()}
        await self.collection.update_one({"id": session_id}, {"$set": update})
        session.update(update)
        return session

    async def attach_photo_to_session(self, session_id: str, photo_id: str) -> None:
        await self.collection.update_one({"id": session_id}, {"$set": {"photoId": photo_id}})


session_service = SessionService()
