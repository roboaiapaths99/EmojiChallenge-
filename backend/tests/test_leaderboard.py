import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_leaderboard_sorting(client: AsyncClient):
    # Create multiple sessions with different scores
    await client.post("/api/sessions", json={"id": "lb_sess_low", "finalScore": 120.0, "mode": "single"})
    await client.post("/api/sessions", json={"id": "lb_sess_high", "finalScore": 950.0, "mode": "single"})
    await client.post("/api/sessions", json={"id": "lb_sess_mid", "finalScore": 550.0, "mode": "single"})

    resp = await client.get("/api/leaderboard?limit=10")
    assert resp.status_code == 200
    data = resp.json()
    entries = data["entries"]
    assert len(entries) >= 3

    scores = [e["score"] for e in entries]
    # Check descending order
    assert scores == sorted(scores, reverse=True)
