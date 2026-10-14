from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional
from app.services.sms_service import sms_service

router = APIRouter(prefix="/auth", tags=["Authentication & OTP"])

class SendOtpRequest(BaseModel):
    mobile: str = Field(..., description="10-digit Indian mobile number")
    playerLabel: Optional[str] = Field("Player 1", description="Player label e.g. Player 1, Player 2")

class VerifyOtpRequest(BaseModel):
    mobile: str = Field(..., description="10-digit Indian mobile number")
    otp: str = Field(..., description="6-digit OTP code")
    playerName: Optional[str] = Field(None, description="Player nickname or name")
    email: Optional[str] = Field(None, description="Player email address for souvenir photo delivery")

class TestSmsRequest(BaseModel):
    mobile: str = Field(..., description="10-digit mobile number")
    message: Optional[str] = Field(None, description="Custom SMS message content")

@router.post("/send-otp")
async def send_otp(req: SendOtpRequest):
    """
    Generate and send 6-digit OTP via MetaReach SMS API.
    """
    success, message, debug_otp = await sms_service.generate_and_send_otp(
        mobile=req.mobile,
        player_label=req.playerLabel or "Player"
    )
    return {
        "success": success,
        "message": message,
        "debugOtp": debug_otp,
    }

@router.post("/verify-otp")
async def verify_otp(req: VerifyOtpRequest):
    """
    Verify OTP entered by player and record lead in Admin attendee database.
    """
    success, message = await sms_service.verify_otp(
        mobile=req.mobile,
        otp_code=req.otp
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )

    clean_mobile = sms_service._normalize_mobile(req.mobile)
    p_name = req.playerName.strip() if req.playerName and req.playerName.strip() else f"Player-{clean_mobile[-4:]}"
    p_email = req.email.strip() if req.email and req.email.strip() else None

    # Record real attendee lead in photo_recipients so it immediately appears in the Admin Panel
    try:
        from app.core.database import get_db
        from app.utils.helpers import utc_now_iso
        db = get_db()
        existing = await db["photo_recipients"].find_one({"mobile": clean_mobile})
        if existing:
            update_data = {
                "name": p_name,
                "isReal": True,
                "isDemo": False,
                "status": "OTP Verified",
                "updatedAt": utc_now_iso()
            }
            if p_email:
                update_data["email"] = p_email
            await db["photo_recipients"].update_one(
                {"mobile": clean_mobile},
                {"$set": update_data}
            )
        else:
            lead_doc = {
                "id": f"rec_{clean_mobile}",
                "photoId": "",
                "sessionId": "",
                "name": p_name,
                "mobile": clean_mobile,
                "email": p_email,
                "score": 0,
                "mode": "single",
                "isReal": True,
                "isDemo": False,
                "downloadedAt": None,
                "createdAt": utc_now_iso(),
                "status": "OTP Verified"
            }
            await db["photo_recipients"].insert_one(lead_doc)
    except Exception as lead_err:
        from app.core.logging import logger
        logger.warning("Could not register attendee lead in db: %s", lead_err)

    return {
        "success": True,
        "message": message,
        "player": {
            "mobile": clean_mobile,
            "name": p_name,
            "email": p_email,
        }
    }

@router.post("/send-test-sms")
async def send_test_sms(req: TestSmsRequest):
    """
    Test endpoint to verify real MetaReach SMS connectivity.
    """
    msg = req.message or "Your verification code is 123456. AGPKAC"
    success, status_msg, data = await sms_service.send_sms(req.mobile, msg)
    return {
        "success": success,
        "message": status_msg,
        "gatewayResponse": data,
    }
