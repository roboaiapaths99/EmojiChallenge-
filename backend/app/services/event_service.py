from typing import List, Optional, Dict, Any
from app.core.database import get_db
from app.utils.helpers import utc_now_iso, generate_id
from app.schemas.event import EventCreateRequest


class EventService:
    """Service managing events and game configuration profiles."""

    @property
    def collection(self):
        return get_db()["events"]

    async def list_events(self) -> List[Dict[str, Any]]:
        cursor = await self.collection.find({"active": True})
        return await cursor.to_list()

    async def get_event(self, event_id: str) -> Optional[Dict[str, Any]]:
        return await self.collection.find_one({"id": event_id})

    async def create_or_update_event(self, req: EventCreateRequest) -> Dict[str, Any]:
        event_id = req.id or generate_id("evt")
        now = utc_now_iso()

        existing = await self.collection.find_one({"id": event_id})
        event_doc = {
            "id": event_id,
            "name": req.name,
            "logo": req.logo,
            "theme": req.theme.model_dump() if req.theme else {},
            "active": req.active,
            "gameConfig": req.gameConfig.model_dump() if req.gameConfig else {},
            "updatedAt": now,
        }

        if existing:
            await self.collection.update_one({"id": event_id}, {"$set": event_doc})
            existing.update(event_doc)
            return existing
        else:
            event_doc["createdAt"] = now
            await self.collection.insert_one(event_doc)
            return event_doc


event_service = EventService()
