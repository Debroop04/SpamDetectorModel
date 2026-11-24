from fastapi import APIRouter, Depends
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User
from app.phone import normalize_number
from app.schemas import SystemStatus
from app.security import current_user
from app.services import translator, twilio_service
from app.services.detector import spam_model
from app.services.public_url import public_base_url, public_url_source
from app.state import get_state

router = APIRouter(prefix="/system", tags=["system"])


def build_status(db: Session, user: User) -> SystemStatus:
    line = normalize_number(settings.TWILIO_PHONE_NUMBER) or None
    owner = db.query(User).filter(User.line_number == line).first() if line else None
    return SystemStatus(
        public_url=public_base_url(),
        public_url_source=public_url_source(),
        twilio_configured=settings.twilio_configured,
        twilio_number=line,
        twilio_sync=get_state(db, "twilio_sync"),
        smtp_configured=settings.smtp_configured,
        smtp_sender=settings.SMTP_USERNAME or None,
        live_delivery_allowed=settings.ALLOW_LIVE_POLICE_EMAIL,
        fallback_police_email=bool(settings.FALLBACK_POLICE_EMAIL),
        model_loaded=spam_model.load(),
        model_error=spam_model.error,
        translator=translator.status(),
        line_owner_is_you=bool(owner and owner.id == user.id),
        line_claimed=owner is not None,
    )


@router.get("/status", response_model=SystemStatus)
def status(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return build_status(db, user)


@router.post("/twilio/sync", response_model=SystemStatus)
async def sync_twilio(user: User = Depends(current_user), db: Session = Depends(get_db)):
    await run_in_threadpool(twilio_service.sync, db)
    return build_status(db, user)
