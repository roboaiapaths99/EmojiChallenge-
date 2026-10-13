from fastapi import APIRouter
from app.api.routes import health, sessions, photos, events, leaderboard, admin, ai, auth

api_router = APIRouter(prefix="/api")

api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(sessions.router)
api_router.include_router(photos.router)
api_router.include_router(events.router)
api_router.include_router(leaderboard.router)
api_router.include_router(admin.router)
api_router.include_router(ai.router)
