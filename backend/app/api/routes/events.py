from typing import List
from fastapi import APIRouter, HTTPException, status
from app.schemas.event import EventCreateRequest, EventResponse
from app.services.event_service import event_service

router = APIRouter(prefix="/events", tags=["Events"])


@router.get("", response_model=List[EventResponse])
async def list_events():
    """GET /api/events - List all active events."""
    events = await event_service.list_events()
    return events


@router.post("", response_model=EventResponse)
async def create_or_update_event(payload: EventCreateRequest):
    """POST /api/events - Create or update an event configuration."""
    event = await event_service.create_or_update_event(payload)
    return event


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(event_id: str):
    """GET /api/events/{event_id} - Retrieve event configuration."""
    event = await event_service.get_event(event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event '{event_id}' not found"
        )
    return event
