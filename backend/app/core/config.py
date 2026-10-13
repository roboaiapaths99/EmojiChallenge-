from typing import List, Union
from pathlib import Path
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_ENV: str = "development"
    APP_NAME: str = "emoji-face-challenge-api"
    HOST: str = "0.0.0.0"
    PORT: int = 8084

    # CORS
    CORS_ORIGINS: Union[str, List[str]] = [
        "https://emojichallenge.technula.com",
        "https://api.emojichallenge.technula.com",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return [
            "http://localhost:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:5174",
        ]

    # Database
    MONGODB_URI: str = ""
    MONGODB_DATABASE: str = "emoji_face_challenge"

    # Storage
    STORAGE_PROVIDER: str = "local"  # "local" | "s3"
    STORAGE_LOCAL_DIR: str = "uploads"
    STORAGE_BUCKET: str = ""
    STORAGE_REGION: str = ""
    STORAGE_ENDPOINT: str = ""
    STORAGE_ACCESS_KEY: str = ""
    STORAGE_SECRET_KEY: str = ""

    # URLs
    PHOTO_BASE_URL: str = "http://localhost:3001"
    MOBILE_CLAIM_BASE_URL: str = "http://localhost:5174"

    # Expirations
    PHOTO_EXPIRY_MINUTES: int = 60
    QR_TOKEN_EXPIRY_MINUTES: int = 60

    # SMS & OTP MetaReach Configuration
    SMS_API_URL: str = "https://sms.metareach.in/vb/apikey.php"
    METAREACH_API_KEY: str = "bmV02HoEeC8RQh9B"
    METAREACH_SENDER_ID: str = "AGPKAC"
    METAREACH_TEMPLATE_ID: str = "1707177071739047190"
    SMS_PE_ID: str = ""
    SMS_TE_ID: str = "1707177071739047190"

    # Security
    ADMIN_SECRET: str = "dev_admin_secret_key"
    JWT_SECRET: str = "dev_jwt_secret_key"

    # Root Directory
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent

    @property
    def UPLOADS_PATH(self) -> Path:
        path = self.BASE_DIR / self.STORAGE_LOCAL_DIR
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def DATA_PATH(self) -> Path:
        path = self.BASE_DIR / "data"
        path.mkdir(parents=True, exist_ok=True)
        return path

    model_config = SettingsConfigDict(
        env_file=[".env", "backend/.env"],
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
