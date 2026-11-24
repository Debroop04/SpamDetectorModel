"""Find the public HTTPS URL that Twilio and police stations use to reach this backend."""

import logging
import time

import httpx

from app.config import settings

logger = logging.getLogger("callshield.public_url")

_cache: dict = {"url": None, "checked_at": 0.0, "source": None}


def _from_ngrok() -> str | None:
    try:
        data = httpx.get(settings.NGROK_API_URL, timeout=1.5).json()
    except Exception:
        return None
    for tunnel in data.get("tunnels", []):
        url = tunnel.get("public_url", "")
        if url.startswith("https://"):
            return url
    return None


def _from_cloudflared() -> str | None:
    try:
        hostname = httpx.get(settings.CLOUDFLARED_METRICS_URL, timeout=1.5).json().get("hostname")
    except Exception:
        return None
    return f"https://{hostname}" if hostname else None


def public_base_url(refresh: bool = False) -> str | None:
    if settings.PUBLIC_BASE_URL:
        return settings.PUBLIC_BASE_URL.rstrip("/")
    if not refresh and time.time() - _cache["checked_at"] < 60:
        return _cache["url"]
    url, source = _from_ngrok(), "ngrok"
    if not url:
        url, source = _from_cloudflared(), "cloudflared"
    if url != _cache["url"]:
        logger.info("Public URL: %s", url or "not found")
    _cache.update(url=url, checked_at=time.time(), source=source if url else None)
    return url


def public_url_source() -> str | None:
    if settings.PUBLIC_BASE_URL:
        return "env"
    public_base_url()
    return _cache["source"]
