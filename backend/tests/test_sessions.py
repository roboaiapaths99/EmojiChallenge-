import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_session_lifecycle_and_idempotency(client: AsyncClient):
    session_id = "test_sess_101"

    # 1. Create session
    create_payload = {
        "id": session_id,
        "mode": "single",
        "p1Score": 450.0,
        "p2Score": 0.0,
        "finalScore": 450.0,
        "rounds": [
            {"roundId": "smile", "score": 100, "durationMs": 3000},
            {"roundId": "surprised", "score": 350, "durationMs": 2800}
        ]
    }
    resp = await client.post("/api/sessions", json=create_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["session"]["id"] == session_id
    assert data["session"]["finalScore"] == 450.0

    # 2. Idempotent re-submission with updated score
    updated_payload = dict(create_payload)
    updated_payload["finalScore"] = 500.0
    resp2 = await client.post("/api/sessions", json=updated_payload)
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["session"]["id"] == session_id
    assert data2["session"]["finalScore"] == 500.0

    # 3. Retrieve session
    get_resp = await client.get(f"/api/sessions/{session_id}")
    assert get_resp.status_code == 200
    get_data = get_resp.json()
    assert get_data["session"]["id"] == session_id

    # 4. Submit round results
    results_payload = {
        "roundResults": [
            {"roundId": "wink", "score": 200, "durationMs": 1500}
        ],
        "finalScore": 700.0
    }
    res_resp = await client.post(f"/api/sessions/{session_id}/results", json=results_payload)
    assert res_resp.status_code == 200
    assert res_resp.json()["session"]["finalScore"] == 700.0

    # 5. Complete session
    comp_resp = await client.post(f"/api/sessions/{session_id}/complete")
    assert comp_resp.status_code == 200
    assert comp_resp.json()["session"]["status"] == "completed"
