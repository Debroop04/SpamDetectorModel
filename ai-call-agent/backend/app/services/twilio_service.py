"""Twilio REST helpers: automatic setup, Voice SDK tokens, live call control, recordings."""

import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy.orm import Session
from twilio.base.exceptions import TwilioRestException
from twilio.jwt.access_token import AccessToken
from twilio.jwt.access_token.grants import VoiceGrant
from twilio.rest import Client

from app.config import settings
from app.phone import normalize_number
from app.services.public_url import public_base_url
from app.state import get_state, set_state

logger = logging.getLogger("callshield.twilio")

APP_FRIENDLY_NAME = "Call Shield Browser Calls"
KEY_FRIENDLY_NAME = "Call Shield Voice SDK"


class TwilioNotReady(RuntimeError):
    pass


def get_client() -> Client:
    if not settings.twilio_configured:
        raise TwilioNotReady("Twilio is not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in backend/.env.")
    return Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)


def webhook_urls(base: str) -> dict[str, str]:
    return {
        "voice": f"{base}/api/twilio/voice",
        "status": f"{base}/api/twilio/status",
    }


def _ensure_application(client: Client, db: Session, urls: dict[str, str]) -> str:
    app_sid = get_state(db, "twilio_app_sid")
    app = None
    if app_sid:
        try:
            app = client.applications(app_sid).fetch()
        except TwilioRestException:
            app = None
    if app is None:
        existing = client.applications.list(friendly_name=APP_FRIENDLY_NAME, limit=1)
        app = existing[0] if existing else client.applications.create(friendly_name=APP_FRIENDLY_NAME)
    app.update(
        voice_url=urls["voice"],
        voice_method="POST",
        status_callback=urls["status"],
        status_callback_method="POST",
    )
    set_state(db, "twilio_app_sid", app.sid)
    return app.sid


def _ensure_api_key(client: Client, db: Session) -> str:
    key_sid = get_state(db, "twilio_api_key_sid")
    secret = get_state(db, "twilio_api_key_secret")
    if key_sid and secret:
        try:
            client.keys(key_sid).fetch()
            return key_sid
        except TwilioRestException:
            pass
    key = client.new_keys.create(friendly_name=KEY_FRIENDLY_NAME)
    set_state(db, "twilio_api_key_sid", key.sid)
    set_state(db, "twilio_api_key_secret", key.secret)
    return key.sid


def sync(db: Session) -> dict:
    """Point the Twilio number and the browser-call app at the current public URL."""
    result: dict = {
        "ok": False,
        "at": datetime.now(timezone.utc).isoformat(),
        "base_url": None,
        "number_configured": False,
        "browser_calling": False,
        "error": None,
    }
    try:
        client = get_client()
        base = public_base_url(refresh=True)
        result["base_url"] = base
        if not base:
            raise TwilioNotReady("No public URL found. Start ngrok or cloudflared, or set PUBLIC_BASE_URL.")
        urls = webhook_urls(base)

        _ensure_application(client, db, urls)
        _ensure_api_key(client, db)
        result["browser_calling"] = True
        result["ok"] = True

        if settings.TWILIO_PHONE_NUMBER:
            number = normalize_number(settings.TWILIO_PHONE_NUMBER)
            found = client.incoming_phone_numbers.list(phone_number=number, limit=1)
            if found:
                found[0].update(
                    voice_url=urls["voice"],
                    voice_method="POST",
                    status_callback=urls["status"],
                    status_callback_method="POST",
                )
                result["number_configured"] = True
            else:
                # Newer trial accounts hide their number from the API. Pointing the number at the
                # TwiML App once in the Console works, because this sync keeps the app's URL current.
                result["error"] = (
                    f"{number} cannot be configured through the API on this trial account. In the Twilio Console, "
                    f"open the number and set 'A call comes in' to TwiML App '{APP_FRIENDLY_NAME}'."
                )
    except (TwilioNotReady, TwilioRestException, httpx.HTTPError) as exc:
        message = getattr(exc, "msg", None) or str(exc)
        result["error"] = message
        logger.warning("Twilio setup incomplete: %s", message)
    set_state(db, "twilio_sync", result)
    return result


def access_token(db: Session, identity: str) -> str:
    app_sid = get_state(db, "twilio_app_sid")
    key_sid = get_state(db, "twilio_api_key_sid")
    secret = get_state(db, "twilio_api_key_secret")
    if not (app_sid and key_sid and secret):
        status = sync(db)
        if not status["ok"]:
            raise TwilioNotReady(status["error"] or "Twilio setup is incomplete.")
        app_sid = get_state(db, "twilio_app_sid")
        key_sid = get_state(db, "twilio_api_key_sid")
        secret = get_state(db, "twilio_api_key_secret")
    token = AccessToken(settings.TWILIO_ACCOUNT_SID, key_sid, secret, identity=identity, ttl=3600)
    token.add_grant(VoiceGrant(outgoing_application_sid=app_sid, incoming_allow=False))
    return token.to_jwt()


def redirect_call(call_sid: str, twiml: str) -> None:
    """Replace the instructions of a live call (used by Block and Connect buttons)."""
    get_client().calls(call_sid).update(twiml=twiml)


def fetch_recording(recording_sid: str) -> httpx.Response:
    url = (
        f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}"
        f"/Recordings/{recording_sid}.mp3"
    )
    return httpx.get(url, auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN), timeout=30, follow_redirects=True)
