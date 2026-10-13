from typing import Dict, Any
from fastapi import APIRouter
from pydantic import BaseModel
from app.services.ai_model_service import (
    EMOJI_PROFILES,
    predict_expression,
    get_model_metrics,
    run_model_benchmark,
)

router = APIRouter(prefix="/ai", tags=["AI Model"])


class PredictRequest(BaseModel):
    blendshapes: Dict[str, float]
    quality: float = 1.0


@router.get("/emojis")
async def get_supported_emojis():
    """List all AI trained emoji profiles and blendshape requirements."""
    return {
        "success": True,
        "total": len(EMOJI_PROFILES),
        "profiles": EMOJI_PROFILES
    }


@router.post("/predict")
async def predict_face_expression(payload: PredictRequest):
    """Predict top emoji match and confidence from facial blendshapes."""
    result = predict_expression(payload.blendshapes, payload.quality)
    return {
        "success": True,
        "prediction": result
    }


@router.get("/metrics")
async def get_ai_model_metrics():
    """Retrieve ML training architecture, accuracy, latency, and performance metrics."""
    return {
        "success": True,
        "metrics": get_model_metrics()
    }


@router.post("/benchmark")
async def trigger_ai_benchmark():
    """Run automated ML evaluation benchmark suite across canonical landmark tests."""
    result = run_model_benchmark()
    return result
