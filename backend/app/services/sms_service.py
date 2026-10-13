import time
import random
import logging
from typing import Dict, Optional, Tuple
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

class SMSService:
    """
    Service for sending SMS via MetaReach API and managing mobile OTP verification.
    """
    def __init__(self):
        # Store OTPs: { clean_mobile: { "otp": str, "expires_at": float, "attempts": int } }
        self._otp_store: Dict[str, dict] = {}

    def _normalize_mobile(self, mobile: str) -> str:
        """Strip non-digits and normalize 10-digit Indian phone number."""
        digits = "".join(ch for ch in str(mobile) if ch.isdigit())
        if len(digits) > 10 and digits.startswith("91"):
            digits = digits[2:]
        elif len(digits) > 10 and digits.startswith("0"):
            digits = digits[1:]
        return digits[-10:] if len(digits) >= 10 else digits

    async def send_sms(self, mobile: str, message: str) -> Tuple[bool, str, dict]:
        """
        Sends an SMS via MetaReach API.
        URL format: https://sms.metareach.in/vb/apikey.php?apikey=...&senderid=...&templateid=...&number=...&message=...
        """
        clean_mobile = self._normalize_mobile(mobile)
        if len(clean_mobile) != 10:
            return False, "Invalid 10-digit mobile number", {}

        params = {
            "apikey": settings.METAREACH_API_KEY,
            "senderid": settings.METAREACH_SENDER_ID,
            "templateid": settings.METAREACH_TEMPLATE_ID or settings.SMS_TE_ID,
            "number": clean_mobile,
            "message": message,
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(settings.SMS_API_URL, params=params)
                response.raise_for_status()
                data = response.json() if "application/json" in response.headers.get("content-type", "") else {}
                if not data:
                    try:
                        data = response.json()
                    except Exception:
                        data = {"raw_text": response.text}

                logger.info("MetaReach SMS API response: %s", data)
                # Check status
                if str(data.get("status", "")).lower() == "success" or data.get("code") == "011":
                    return True, "SMS sent successfully", data
                else:
                    desc = data.get("description") or data.get("message") or "Failed to send SMS"
                    return False, str(desc), data
        except Exception as e:
            logger.error("MetaReach SMS API connection error: %s", str(e))
            return False, f"SMS Gateway Error: {str(e)}", {}

    async def generate_and_send_otp(self, mobile: str, player_label: str = "Player") -> Tuple[bool, str, Optional[str]]:
        """
        Generates a 6-digit OTP and sends it via MetaReach SMS API.
        Returns: (success, message, debug_otp_if_dev)
        """
        clean_mobile = self._normalize_mobile(mobile)
        if len(clean_mobile) != 10:
            return False, "Please enter a valid 10-digit mobile number", None

        # Generate 6-digit OTP
        otp = f"{random.randint(100000, 999999)}"
        expires_at = time.time() + 300  # 5 minutes validity

        record = {
            "otp": otp,
            "expires_at": expires_at,
            "attempts": 0,
            "player_label": player_label,
            "mobile": clean_mobile,
        }
        self._otp_store[clean_mobile] = record

        # Persist to shared database across all Uvicorn worker processes
        try:
            from app.core.database import get_db
            db = get_db()
            await db["otp_verifications"].update_one(
                {"mobile": clean_mobile},
                {"$set": record},
                upsert=True
            )
        except Exception as db_err:
            logger.warning("Could not persist OTP in database: %s", db_err)

        # DLT-approved template text for template ID 1707177071739047190
        message = f"Welcome to AGPK Academy login. Your verification code is {otp}. This OTP will expire in 5 minutes"

        success, msg, data = await self.send_sms(clean_mobile, message)
        logger.info("Generated real OTP for %s (Gateway Status: %s)", clean_mobile, msg)

        if success:
            return True, f"OTP sent to +91 {clean_mobile[:2]}******{clean_mobile[-2:]}. Check your phone SMS.", None
        else:
            return False, f"SMS Gateway Error: {msg}", None

    async def verify_otp(self, mobile: str, otp_code: str) -> Tuple[bool, str]:
        """
        Verifies entered OTP against cached store and shared database.
        """
        clean_mobile = self._normalize_mobile(mobile)
        # Check shared database first for authoritative multi-worker state
        record = None
        try:
            from app.core.database import get_db
            db = get_db()
            record = await db["otp_verifications"].find_one({"mobile": clean_mobile})
        except Exception as db_err:
            logger.warning("Could not query DB for OTP: %s", db_err)

        if not record:
            record = self._otp_store.get(clean_mobile)

        if not record:
            return False, "No OTP requested for this mobile number. Please click Send OTP."

        if time.time() > float(record.get("expires_at", 0)):
            self._otp_store.pop(clean_mobile, None)
            try:
                from app.core.database import get_db
                db = get_db()
                await db["otp_verifications"].delete_one({"mobile": clean_mobile})
            except Exception:
                pass
            return False, "OTP has expired. Please request a new one."

        attempts = int(record.get("attempts", 0)) + 1
        record["attempts"] = attempts
        if attempts > 5:
            self._otp_store.pop(clean_mobile, None)
            try:
                from app.core.database import get_db
                db = get_db()
                await db["otp_verifications"].delete_one({"mobile": clean_mobile})
            except Exception:
                pass
            return False, "Too many incorrect attempts. Please request a new OTP."

        if str(otp_code).strip() != str(record.get("otp", "")).strip():
            return False, "Incorrect OTP code. Please check and try again."

        # OTP is verified! Clear it so it cannot be reused
        self._otp_store.pop(clean_mobile, None)
        try:
            from app.core.database import get_db
            db = get_db()
            await db["otp_verifications"].delete_one({"mobile": clean_mobile})
        except Exception:
            pass

        return True, "Mobile verified successfully!"

sms_service = SMSService()
