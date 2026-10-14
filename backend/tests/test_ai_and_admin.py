import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_ai_emojis_catalog(client: AsyncClient):
    response = await client.get("/api/ai/emojis")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["total"] == 20
    assert len(data["profiles"]) == 20


@pytest.mark.asyncio
async def test_ai_predict_and_telemetry(client: AsyncClient):
    # Test high smile prediction
    payload = {
        "blendshapes": {
            "mouthSmileLeft": 0.85,
            "mouthSmileRight": 0.85,
            "jawOpen": 0.15,
        },
        "quality": 1.0
    }
    response = await client.post("/api/ai/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    pred = data["prediction"]
    assert pred["predictedEmoji"] in ["😀", "😍", "😆"]
    assert pred["confidence"] >= 50
    assert "features" in pred
    assert pred["features"]["smileScore"] >= 80


@pytest.mark.asyncio
async def test_ai_metrics_and_benchmark(client: AsyncClient):
    # Metrics
    res_metrics = await client.get("/api/ai/metrics")
    assert res_metrics.status_code == 200
    m_data = res_metrics.json()
    assert m_data["metrics"]["overallAccuracy"] >= 95.0

    # Benchmark
    res_bench = await client.post("/api/ai/benchmark")
    assert res_bench.status_code == 200
    b_data = res_bench.json()
    assert b_data["success"] is True
    assert b_data["accuracy"] >= 90.0


@pytest.mark.asyncio
async def test_admin_stats_and_real_leads(client: AsyncClient):
    from app.core.config import settings
    headers = {"x-admin-secret": settings.ADMIN_SECRET}

    # Stats
    res_stats = await client.get("/api/admin/stats", headers=headers)
    assert res_stats.status_code == 200
    s_data = res_stats.json()
    assert "totalRecipients" in s_data["stats"]
    assert "conversionRate" in s_data["stats"]

    # Recipients
    res_rec = await client.get("/api/admin/recipients?limit=50", headers=headers)
    assert res_rec.status_code == 200
    r_data = res_rec.json()
    assert isinstance(r_data.get("recipients"), list)
    if len(r_data["recipients"]) > 0:
        assert "mobile" in r_data["recipients"][0]
