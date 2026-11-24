"""Endpoints used by the Android app and the website's download page."""

import json
from pathlib import Path

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db, utcnow
from app.models import NumberRule, SpamNumber, User
from app.phone import normalize_number
from app.schemas import UserOut
from app.security import current_user
from app.services.discovery import lan_addresses
from app.services.public_url import public_base_url

router = APIRouter(tags=["app"])

DANGEROUS_REPORTS = 3


def latest_apk() -> dict | None:
    path = Path(settings.APK_DIR) / "version.json"
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


@router.get("/app/info")
def app_info():
    """Public: server addresses for connecting the app, and the newest APK version."""
    port = settings.APP_PORT
    return {
        "lan_servers": [f"http://{ip}:{port}" for ip in lan_addresses()],
        "public_server": public_base_url(),
        "latest": latest_apk(),
    }


@router.get("/me/sync")
def sync(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Everything the phone caches to decide calls offline within Android's 5 second limit."""
    rules = db.query(NumberRule).filter(NumberRule.user_id == user.id).all()
    dangerous = (
        db.query(SpamNumber)
        .filter(SpamNumber.reports >= DANGEROUS_REPORTS)
        .order_by(SpamNumber.reports.desc())
        .limit(5000)
        .all()
    )
    line = normalize_number(settings.TWILIO_PHONE_NUMBER) or None
    return {
        "user": UserOut.model_validate(user),
        "line_number": line,
        "forward_to": line,
        "blocked": [r.number for r in rules if r.kind == "block"],
        "trusted": [r.number for r in rules if r.kind == "allow"],
        "dangerous": [{"number": n.number, "reports": n.reports, "category": n.category} for n in dangerous],
        "synced_at": utcnow().isoformat() + "Z",
    }
