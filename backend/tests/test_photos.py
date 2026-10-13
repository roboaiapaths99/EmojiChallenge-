import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_photo_upload_and_token_lookup(client: AsyncClient):
    session_id = "test_sess_photo_1"

    # Create session first
    await client.post("/api/sessions", json={
        "id": session_id,
        "mode": "single",
        "finalScore": 880.0
    })

    # 1. Upload photo
    # Minimal 1x1 valid JPEG bytes
    dummy_jpeg = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9"

    files = {"photo": ("souvenir.jpg", dummy_jpeg, "image/jpeg")}
    upload_resp = await client.post(f"/api/sessions/{session_id}/photo", files=files)
    assert upload_resp.status_code == 200
    upload_data = upload_resp.json()
    assert upload_data["success"] is True
    assert "token" in upload_data
    assert "claimUrl" in upload_data
    assert "previewUrl" in upload_data
    token = upload_data["token"]

    # 2. Look up photo by plain token
    token_resp = await client.get(f"/api/photos/token/{token}")
    assert token_resp.status_code == 200
    token_data = token_resp.json()
    assert token_data["success"] is True
    assert token_data["photoId"] == upload_data["photoId"]
    assert token_data["session"] is not None
    assert token_data["session"]["finalScore"] == 880.0

    # 3. List recent photos
    recent_resp = await client.get("/api/photos/recent")
    assert recent_resp.status_code == 200
    recent_data = recent_resp.json()
    assert len(recent_data["photos"]) >= 1

    # 4. Non-existent token returns 404
    bad_token_resp = await client.get("/api/photos/token/nonexistent_fake_token_123")
    assert bad_token_resp.status_code == 404
