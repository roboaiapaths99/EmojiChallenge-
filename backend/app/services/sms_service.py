import time
import random
import logging
import json
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

    def _read_otp_file(self) -> dict:
        otp_file = settings.DATA_PATH / "active_otps.json"
        if not otp_file.exists():
            return {}
        try:
            with open(otp_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning("Could not read active_otps.json: %s", e)
            return {}

    def _write_otp_file(self, data: dict):
        otp_file = settings.DATA_PATH / "active_otps.json"
        try:
            otp_file.parent.mkdir(parents=True, exist_ok=True)
            tmp = otp_file.with_suffix(".tmp")
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            tmp.replace(otp_file)
        except Exception as e:
            logger.warning("Could not write active_otps.json: %s", e)

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

        # Read existing file to preserve recent valid OTPs (prevents resend race condition)
        file_data = self._read_otp_file()
        prev_record = file_data.get(clean_mobile, {})
        recent_otps = prev_record.get("recent_otps", [])
        if prev_record.get("otp"):
            recent_otps.append(str(prev_record["otp"]).strip())
        recent_otps.append(otp)
        recent_otps = list(set(recent_otps))[-3:]  # Retain up to 3 most recent active OTPs

        record = {
            "otp": otp,
            "recent_otps": recent_otps,
            "expires_at": expires_at,
            "attempts": 0,
            "player_label": player_label,
            "mobile": clean_mobile,
        }
        self._otp_store[clean_mobile] = record

        # Persist to disk file shared across all Uvicorn worker processes
        file_data[clean_mobile] = record
        self._write_otp_file(file_data)

        # Also persist to database if available
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
        logger.info("Generated real OTP %s for %s (Gateway Status: %s)", otp, clean_mobile, msg)

        if success:
            return True, f"OTP sent to +91 {clean_mobile[:2]}******{clean_mobile[-2:]}. Check your phone SMS.", None
        else:
            return False, f"SMS Gateway Error: {msg}", None

    async def verify_otp(self, mobile: str, otp_code: str) -> Tuple[bool, str]:
        """
        Verifies entered OTP against file store, memory store, and database.
        """
        clean_mobile = self._normalize_mobile(mobile)
        input_code = str(otp_code).strip()
        logger.info("Verifying OTP for mobile %s with input: '%s'", clean_mobile, input_code)

        # 1. Master / Emergency Kiosk Bypass code for event testing & backup
        if input_code == "999999":
            logger.info("Master bypass OTP accepted for mobile %s", clean_mobile)
            return True, "Mobile verified successfully (Master Code)!"

        # 2. Check disk-shared file store (fresh read from disk for multi-worker sync)
        file_data = self._read_otp_file()
        record = file_data.get(clean_mobile)

        # 3. Check database if not found in file
        if not record:
            try:
                from app.core.database import get_db
                db = get_db()
                record = await db["otp_verifications"].find_one({"mobile": clean_mobile})
            except Exception as db_err:
                logger.warning("Could not query DB for OTP: %s", db_err)

        # 4. Check local process memory
        if not record:
            record = self._otp_store.get(clean_mobile)

        if not record:
            logger.warning("No OTP requested for mobile %s. Active keys in file: %s", clean_mobile, list(file_data.keys()))
            return False, "No OTP requested for this mobile number. Please click Send OTP."

        expires_at = float(record.get("expires_at", 0))
        if time.time() > expires_at:
            logger.warning("OTP for %s expired at %s (now: %s)", clean_mobile, expires_at, time.time())
            file_data.pop(clean_mobile, None)
            self._write_otp_file(file_data)
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
        file_data[clean_mobile] = record
        self._write_otp_file(file_data)

        if attempts > 7:
            file_data.pop(clean_mobile, None)
            self._write_otp_file(file_data)
            self._otp_store.pop(clean_mobile, None)
            try:
                from app.core.database import get_db
                db = get_db()
                await db["otp_verifications"].delete_one({"mobile": clean_mobile})
            except Exception:
                pass
            return False, "Too many incorrect attempts. Please request a new OTP."

        # Verify against either primary OTP or any recent active OTP sent to this number
        expected_otp = str(record.get("otp", "")).strip()
        recent_otps = [str(x).strip() for x in record.get("recent_otps", [])]
        valid_otps = set([expected_otp] + recent_otps)
        valid_otps.discard("")

        logger.info("Mobile %s: input='%s', expected=%s", clean_mobile, input_code, list(valid_otps))

        if input_code not in valid_otps:
            logger.warning("OTP mismatch for %s: entered '%s', expected %s", clean_mobile, input_code, list(valid_otps))
            return False, "Incorrect OTP code. Please check and try again."

        # OTP is verified! Clean up so it cannot be reused
        file_data.pop(clean_mobile, None)
        self._write_otp_file(file_data)
        self._otp_store.pop(clean_mobile, None)
        try:
            from app.core.database import get_db
            db = get_db()
            await db["otp_verifications"].delete_one({"mobile": clean_mobile})
        except Exception:
            pass

        logger.info("Mobile %s successfully verified!", clean_mobile)
        return True, "Mobile verified successfully!"

sms_service = SMSService()
