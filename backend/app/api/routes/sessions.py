import os
import time
import secrets
from fastapi import APIRouter, HTTPException, status, UploadFile, File, Request
from app.schemas.session import CreateSessionRequest, SessionResultSubmission, SessionResponse
from app.schemas.photo import PhotoUploadResponse
from app.services.session_service import session_service
from app.services.photo_service import photo_service
from app.services.storage_service import storage_service
from app.services.qr_service import qr_service
from app.utils.validators import validate_image_file
from app.core.logging import logger

router = APIRouter(prefix="/sessions", tags=["Sessions"])


@router.post("", response_model=SessionResponse)
async def create_or_upsert_session(payload: CreateSessionRequest):
    """
    1. POST /api/sessions - Create or update game session.
    Idempotent operation preserving existing frontend contract.
    """
    try:
        session = await session_service.create_or_upsert_session(payload)
        return {"success": True, "session": session}
    except Exception as e:
        logger.error("Error creating session: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/{session_id}/photo", response_model=PhotoUploadResponse)
async def upload_session_photo(
    session_id: str,
    request: Request,
    photo: UploadFile = File(...)
):
    """
    2. POST /api/sessions/:id/photo - Upload captured souvenir photo.
    Validates file, generates secure token, and records metadata.
    """
    try:
        content = await photo.read()
        validate_image_file(photo, content)

        # Generate unique storage filename
        ext = os.path.splitext(photo.filename or "")[1].lower() or ".jpg"
        unique_name = f"{int(time.time() * 1000)}_{secrets.token_hex(4)}{ext}"

        # Save to storage
        storage_key = await storage_service.save_photo(unique_name, content)

        # Create photo record & cryptographic token
        photo_doc, token = await photo_service.create_photo(session_id, storage_key)

        # Associate photo with session
        await session_service.attach_photo_to_session(session_id, photo_doc["id"])

        # Link session, score and photo to attendee lead in photo_recipients
        try:
            from app.core.database import get_db
            from app.utils.helpers import utc_now_iso
            from app.services.sms_service import sms_service
            db = get_db()
            sess = await session_service.get_session(session_id)
            if sess:
                final_score = int(sess.get("finalScore", 0))
                mode = sess.get("mode", "single")
                players = sess.get("players", [])

                for p in players:
                    p_mob = str(p.get("mobile", "")).strip()
                    p_name = p.get("name", "").strip() or sess.get("playerName", "Challenger")
                    p_email = p.get("email") or None
                    if p_mob:
                        clean_m = sms_service._normalize_mobile(p_mob)
                        existing_lead = await db["photo_recipients"].find_one({"mobile": clean_m})
                        if existing_lead:
                            up_data = {
                                "photoId": photo_doc["id"],
                                "sessionId": session_id,
                                "score": final_score,
                                "mode": mode,
                                "status": "Photo Ready",
                                "updatedAt": utc_now_iso()
                            }
                            if p_name and not p_name.startswith("Player-"):
                                up_data["name"] = p_name
                            if p_email:
                                up_data["email"] = p_email
                            await db["photo_recipients"].update_one({"mobile": clean_m}, {"$set": up_data})
                        else:
                            new_lead = {
                                "id": f"rec_{clean_m}",
                                "photoId": photo_doc["id"],
                                "sessionId": session_id,
                                "name": p_name,
                                "mobile": clean_m,
                                "email": p_email,
                                "score": final_score,
                                "mode": mode,
                                "isReal": True,
                                "isDemo": False,
                                "status": "Photo Ready",
                                "downloadedAt": None,
                                "createdAt": utc_now_iso(),
                            }
                            await db["photo_recipients"].insert_one(new_lead)
        except Exception as link_err:
            logger.warning("Could not link attendee lead to photo: %s", link_err)

        host = request.headers.get("host") or "localhost:3001"
        scheme = request.url.scheme or "http"

        # Check for multi-file emoji action photos in form
        emoji_photos_meta = []
        try:
            form = await request.form()
            raw_meta = form.get("emojiMeta")
            if raw_meta:
                import json
                parsed_meta = json.loads(raw_meta) if isinstance(raw_meta, str) else []
                for idx, meta_item in enumerate(parsed_meta):
                    field_name = f"emoji_photo_{idx}"
                    file_item = form.get(field_name)
                    if file_item and hasattr(file_item, "read"):
                        f_content = await file_item.read()
                        f_name = f"{int(time.time() * 1000)}_{secrets.token_hex(4)}.jpg"
                        f_key = await storage_service.save_photo(f_name, f_content)
                        emoji_photos_meta.append({
                            "emoji": meta_item.get("emoji", "😀"),
                            "name": meta_item.get("name", "Emoji"),
                            "roundName": meta_item.get("roundName", "Round"),
                            "score": meta_item.get("score", 0),
                            "storageKey": f_key,
                            "previewUrl": qr_service.build_preview_url(f_key, host, scheme)
                        })
                if emoji_photos_meta:
                    await photo_service.update_photo(photo_doc["id"], {"emojiPhotos": emoji_photos_meta})
                    photo_doc["emojiPhotos"] = emoji_photos_meta
        except Exception as form_err:
            logger.warning("Could not parse extra emoji photos: %s", form_err)

        preview_url = qr_service.build_preview_url(storage_key, host, scheme)
        claim_url = qr_service.build_claim_url(token, host, scheme)

        return {
            "success": True,
            "photoId": photo_doc["id"],
            "token": token,
            "expiresAt": photo_doc["expiresAt"],
            "previewUrl": preview_url,
            "claimUrl": claim_url,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error uploading photo for session %s: %s", session_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str):
    """GET /api/sessions/{session_id} - Retrieve game session by ID."""
    session = await session_service.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Game session '{session_id}' not found"
        )
    return {"success": True, "session": session}


@router.post("/{session_id}/results", response_model=SessionResponse)
async def save_session_results(session_id: str, results: SessionResultSubmission):
    """POST /api/sessions/{session_id}/results - Submit game round results."""
    session = await session_service.update_session_results(session_id, results)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Game session '{session_id}' not found"
        )
    return {"success": True, "session": session}


@router.post("/{session_id}/complete", response_model=SessionResponse)
async def complete_session(session_id: str):
    """POST /api/sessions/{session_id}/complete - Mark game session completed."""
    session = await session_service.complete_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Game session '{session_id}' not found"
        )
    return {"success": True, "session": session}
