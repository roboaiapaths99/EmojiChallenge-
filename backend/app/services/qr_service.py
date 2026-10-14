import socket
from typing import Optional
from app.core.config import settings


def get_lan_ip() -> str:
    """Detect LAN IPv4 address so QR code points to an address phones on Wi-Fi can open."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


class QRService:
    """Service generating secure claim URLs and handling QR token lifecycle."""

    @staticmethod
    def build_claim_url(token: str, request_host: Optional[str] = None, request_scheme: str = "https") -> str:
        """
        Build mobile claim URL for QR code pointing to the interactive claim & download page.
        Always points to public live domain so any mobile phone scanning the QR code can open it.
        """
        base = settings.MOBILE_CLAIM_BASE_URL or settings.PHOTO_BASE_URL
        if base and "localhost" not in base and "127.0.0.1" not in base:
            return f"{base.rstrip('/')}/claim/{token}"

        if request_host and "emojichallenge.technula.com" in request_host:
            return f"https://{request_host}/claim/{token}"

        return f"https://api.emojichallenge.technula.com/claim/{token}"

    @staticmethod
    def build_preview_url(storage_key: str, request_host: Optional[str] = None, request_scheme: str = "http") -> str:
        if request_host:
            return f"{request_scheme}://{request_host}/uploads/{storage_key}"
        return f"{settings.PHOTO_BASE_URL}/uploads/{storage_key}"

    @staticmethod
    def build_download_url(token: str, recipient_id: str, request_host: Optional[str] = None, request_scheme: str = "http") -> str:
        if request_host:
            return f"{request_scheme}://{request_host}/api/photos/token/{token}/download?recipientId={recipient_id}"
        return f"{settings.PHOTO_BASE_URL}/api/photos/token/{token}/download?recipientId={recipient_id}"


qr_service = QRService()
