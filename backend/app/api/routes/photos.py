from typing import Optional
from fastapi import APIRouter, HTTPException, status, Request, Query
from fastapi.responses import FileResponse
from app.schemas.photo import PhotoDetailsResponse, RecentPhotosResponse
from app.schemas.recipient import ClaimRecipientRequest, ClaimRecipientResponse
from app.services.photo_service import photo_service
from app.services.session_service import session_service
from app.services.storage_service import storage_service
from app.services.qr_service import qr_service
from app.utils.validators import validate_name, validate_mobile
from app.core.logging import logger

router = APIRouter(prefix="/photos", tags=["Photos"])


@router.get("/token/{token}", response_model=PhotoDetailsResponse)
async def get_photo_by_token(token: str, request: Request):
    """
    3. GET /api/photos/token/:token - Resolve token for Mobile App.
    Validates expiration and returns photo preview + session summary.
    """
    photo = await photo_service.get_photo_by_token(token)
    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo not found or QR token has expired."
        )

    session = await session_service.get_session(photo["sessionId"])
    host = request.headers.get("host") or "localhost:3001"
    scheme = request.url.scheme or "http"
    preview_url = qr_service.build_preview_url(photo["storageKey"], host, scheme)

    session_summary = None
    if session:
        session_summary = {
            "mode": session.get("mode", "single"),
            "p1Score": float(session.get("p1Score", 0)),
            "p2Score": float(session.get("p2Score", 0)),
            "finalScore": float(session.get("finalScore", 0)),
            "rounds": session.get("rounds", []),
            "createdAt": session.get("createdAt"),
        }

    return {
        "success": True,
        "photoId": photo["id"],
        "previewUrl": preview_url,
        "expiresAt": photo["expiresAt"],
        "session": session_summary,
    }


@router.get("/recent", response_model=RecentPhotosResponse)
async def list_recent_photos(request: Request, limit: int = Query(20, ge=1, le=50)):
    """
    3b. GET /api/photos/recent - List recent photos for mobile gallery / quick-select.
    """
    photos = await photo_service.list_recent_photos(limit)
    host = request.headers.get("host") or "localhost:3001"
    scheme = request.url.scheme or "http"

    formatted_photos = []
    for p in photos:
        storage_key = p["storageKey"]
        plain_token = p.get("plainToken", "")
        session = p.get("session")

        formatted_photos.append({
            "id": p["id"],
            "plainToken": plain_token,
            "createdAt": p.get("createdAt", ""),
            "expiresAt": p.get("expiresAt", 0),
            "previewUrl": qr_service.build_preview_url(storage_key, host, scheme),
            "claimUrl": qr_service.build_claim_url(plain_token, host, scheme),
            "session": {
                "mode": session.get("mode", "single"),
                "p1Score": float(session.get("p1Score", 0)),
                "p2Score": float(session.get("p2Score", 0)),
                "finalScore": float(session.get("finalScore", 0)),
            } if session else None,
        })

    return {"success": True, "photos": formatted_photos}


@router.post("/token/{token}/recipients", response_model=ClaimRecipientResponse)
@router.post("/{token}/recipients", response_model=ClaimRecipientResponse)
async def claim_photo_recipient(token: str, payload: ClaimRecipientRequest, request: Request):
    """
    4. POST /api/photos/token/:token/recipients - Register mobile claimant.
    Validates form data and creates secure download link.
    """
    name = validate_name(payload.name)
    mobile = validate_mobile(payload.mobile)

    photo = await photo_service.get_photo_by_token(token)
    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired token"
        )

    recipient = await photo_service.add_recipient(
        photo_id=photo["id"],
        name=name,
        mobile=mobile,
        email=payload.email
    )

    host = request.headers.get("host") or "localhost:3001"
    scheme = request.url.scheme or "http"
    download_url = qr_service.build_download_url(token, recipient["id"], host, scheme)

    return {
        "success": True,
        "recipientId": recipient["id"],
        "downloadUrl": download_url
    }


@router.get("/token/{token}/download")
@router.get("/{token}/download")
async def download_photo(token: str, recipientId: Optional[str] = Query(None)):
    """
    5. GET /api/photos/token/:token/download - Authorize and stream photo download.
    """
    photo = await photo_service.get_photo_by_token(token)
    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Download link expired or invalid."
        )

    file_path = storage_service.get_photo_path(photo["storageKey"])
    if not file_path or not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found on server."
        )

    if recipientId:
        await photo_service.mark_downloaded(recipientId)

    return FileResponse(
        path=str(file_path),
        media_type="image/jpeg",
        filename="emoji-face-challenge.jpg",
        headers={"Content-Disposition": 'attachment; filename="emoji-face-challenge.jpg"'}
    )


@router.get("/token/{token}/download-all")
@router.get("/{token}/download-all")
async def download_all_photos_zip(token: str, recipientId: Optional[str] = Query(None)):
    """
    Download a single ZIP containing the souvenir pose card + all candid emoji action photos.
    """
    import io
    import zipfile
    from fastapi.responses import Response

    photo = await photo_service.get_photo_by_token(token)
    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Download link expired or invalid."
        )

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        # Add main souvenir pose card
        main_path = storage_service.get_photo_path(photo["storageKey"])
        if main_path and main_path.exists():
            zip_file.write(str(main_path), arcname="01_Official_Souvenir_Pose_Card.jpg")

        # Add candid emoji action photos
        emoji_photos = photo.get("emojiPhotos", [])
        for i, ep in enumerate(emoji_photos):
            ep_key = ep.get("storageKey")
            if ep_key:
                ep_path = storage_service.get_photo_path(ep_key)
                if ep_path and ep_path.exists():
                    clean_name = str(ep.get("name", "expression")).replace(" ", "_")
                    score_val = ep.get("score", 0)
                    zip_file.write(str(ep_path), arcname=f"{i+2:02d}_Emoji_{clean_name}_{score_val}pts.jpg")

        # Add commemorative text note
        cert_text = (
            "=====================================================\n"
            "✨ EMOJI FACE CHALLENGE - OFFICIAL SOUVENIR PACKAGE ✨\n"
            "=====================================================\n\n"
            f"Token: {token}\n"
            f"Total Photos: {1 + len(emoji_photos)}\n\n"
            "Thank you for playing at our event!\n"
            "Share your photos and scores on WhatsApp and social media!\n"
            "=====================================================\n"
        )
        zip_file.writestr("Souvenir_Package_Info.txt", cert_text)

    zip_buffer.seek(0)
    if recipientId:
        await photo_service.mark_downloaded(recipientId)

    return Response(
        content=zip_buffer.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="emoji-face-challenge-all-photos.zip"'}
    )


@router.get("/token/{token}/emoji/{idx}")
@router.get("/{token}/emoji/{idx}")
async def download_single_emoji_photo(token: str, idx: int):
    """
    Download a single candid emoji photo by index.
    """
    photo = await photo_service.get_photo_by_token(token)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    emoji_photos = photo.get("emojiPhotos", [])
    if idx < 0 or idx >= len(emoji_photos):
        raise HTTPException(status_code=404, detail="Emoji photo not found")
    ep = emoji_photos[idx]
    ep_path = storage_service.get_photo_path(ep.get("storageKey", ""))
    if not ep_path or not ep_path.exists():
        raise HTTPException(status_code=404, detail="File not found on server")
    return FileResponse(
        path=str(ep_path),
        media_type="image/jpeg",
        filename=f"emoji-{idx+1}.jpg",
        headers={"Content-Disposition": f'attachment; filename="emoji-{idx+1}.jpg"'}
    )
