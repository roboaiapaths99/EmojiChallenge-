import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_recipient_registration_and_download(client: AsyncClient):
    session_id = "test_sess_rec_1"

    # Setup session & photo
    await client.post("/api/sessions", json={"id": session_id, "mode": "single"})
    dummy_jpeg = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9"
    upload_resp = await client.post(
        f"/api/sessions/{session_id}/photo",
        files={"photo": ("rec_test.jpg", dummy_jpeg, "image/jpeg")}
    )
    token = upload_resp.json()["token"]

    # 1. Register Recipient 1
    rec1_payload = {
        "name": "Alex Smith",
        "mobile": "+1234567890",
        "email": "alex@example.com"
    }
    rec1_resp = await client.post(f"/api/photos/token/{token}/recipients", json=rec1_payload)
    assert rec1_resp.status_code == 200
    rec1_data = rec1_resp.json()
    assert rec1_data["success"] is True
    assert "downloadUrl" in rec1_data
    rec1_id = rec1_data["recipientId"]

    # 2. Register Recipient 2 for same photo (Multi-recipient support)
    rec2_payload = {
        "name": "Jordan Taylor",
        "mobile": "+9876543210"
    }
    rec2_resp = await client.post(f"/api/photos/token/{token}/recipients", json=rec2_payload)
    assert rec2_resp.status_code == 200
    rec2_data = rec2_resp.json()
    assert rec2_data["success"] is True
    assert rec2_data["recipientId"] != rec1_id

    # 3. Download photo
    download_resp = await client.get(f"/api/photos/token/{token}/download?recipientId={rec1_id}")
    assert download_resp.status_code == 200
    assert download_resp.headers["content-type"] == "image/jpeg"
    assert "attachment" in download_resp.headers["content-disposition"]
    assert len(download_resp.content) == len(dummy_jpeg)

    # 4. Form validation failure on missing mobile
    invalid_resp = await client.post(f"/api/photos/token/{token}/recipients", json={"name": "Bob", "mobile": ""})
    assert invalid_resp.status_code in (400, 422)
