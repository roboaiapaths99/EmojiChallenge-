import time
from datetime import datetime, timezone
import secrets


def utc_now_iso() -> str:
    """Return current UTC timestamp in ISO 8601 string format."""
    return datetime.now(timezone.utc).isoformat()


def current_time_ms() -> int:
    """Return current Unix timestamp in milliseconds."""
    return int(time.time() * 1000)


def generate_id(prefix: str = "id") -> str:
    """Generate unique prefixed identifier."""
    return f"{prefix}_{secrets.token_hex(8)}"
