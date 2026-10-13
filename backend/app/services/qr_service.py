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
    def build_claim_url(token: str, request_host: Optional[str] = None, request_scheme: str = "http") -> str:
        """
        Build mobile claim URL for QR code pointing to the interactive claim & download page.
        Automatically converts localhost to local LAN IP so phones on the event Wi-Fi can open it.
        """
        lan_ip = get_lan_ip()
        port = settings.PORT

        if request_host:
            # If request is from localhost / loopback, swap in LAN IP for mobile phone friendliness
            if "localhost" in request_host or "127.0.0.1" in request_host:
                host_with_port = f"{lan_ip}:{port}"
            else:
                host_with_port = request_host
            return f"{request_scheme}://{host_with_port}/claim/{token}"

        return f"http://{lan_ip}:{port}/claim/{token}"

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
