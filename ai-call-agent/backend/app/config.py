"""Application settings loaded from environment variables and backend/.env."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "Call Shield"
    ENVIRONMENT: str = "development"
    SECRET_KEY: str = "dev-only-secret-key-change-me-before-deploying-1234"
    ACCESS_TOKEN_DAYS: int = 7

    DATABASE_URL: str = f"sqlite:///{BACKEND_DIR / 'callshield.db'}"
    FRONTEND_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Public HTTPS URL that Twilio and police stations can reach (ngrok or cloudflared).
    # Leave empty to auto-detect a running local ngrok or cloudflared tunnel.
    PUBLIC_BASE_URL: str = ""
    NGROK_API_URL: str = "http://127.0.0.1:4040/api/tunnels"
    CLOUDFLARED_METRICS_URL: str = "http://127.0.0.1:20241/quicktunnel"

    # Port this API listens on, announced to the Android app on the local network.
    APP_PORT: int = 8000
    DISCOVERY_ENABLED: bool = True
    # Where the website keeps the Android APK and its version file.
    APK_DIR: str = str(PROJECT_DIR / "frontend" / "public" / "downloads")

    # Spam model built by the ML team. Loaded read-only.
    MODEL_DIR: str = str(PROJECT_DIR / "spam-detector")

    # Twilio
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""
    TWILIO_VALIDATE_SIGNATURE: bool = True
    TWILIO_VOICE: str = "Polly.Aditi"
    TWILIO_SPEECH_MODEL: str = ""

    # Email (Gmail SMTP with an app password works for free)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_NAME: str = "Call Shield"
    FALLBACK_POLICE_EMAIL: str = ""
    ALLOW_LIVE_POLICE_EMAIL: bool = False

    # Detection
    SUSPICIOUS_THRESHOLD: float = 0.45
    DEFAULT_BLOCK_THRESHOLD: float = 0.75
    INSTANT_BLOCK_REPUTATION: float = 0.9
    MAX_SCREENING_TURNS: int = 2
    DEFAULT_COUNTRY_CODE: str = "91"
    TRANSLATOR: str = "auto"  # auto | local | online | off

    # OpenStreetMap services
    OVERPASS_URLS: str = (
        "https://overpass-api.de/api/interpreter,"
        "https://overpass.kumi.systems/api/interpreter,"
        "https://maps.mail.ru/osm/tools/overpass/api/interpreter,"
        "https://overpass.private.coffee/api/interpreter"
    )
    NOMINATIM_URL: str = "https://nominatim.openstreetmap.org"
    HTTP_USER_AGENT: str = "CallShield/1.0 (open-source student project)"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.FRONTEND_ORIGINS.split(",") if o.strip()]

    @property
    def twilio_configured(self) -> bool:
        return bool(self.TWILIO_ACCOUNT_SID and self.TWILIO_AUTH_TOKEN)

    @property
    def smtp_configured(self) -> bool:
        return bool(self.SMTP_USERNAME and self.SMTP_PASSWORD)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
