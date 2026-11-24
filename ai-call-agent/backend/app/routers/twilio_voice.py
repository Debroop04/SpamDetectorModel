"""Twilio voice webhooks and the browser-calling access token."""

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, Response
from sqlalchemy.orm import Session
from twilio.request_validator import RequestValidator
from twilio.twiml.voice_response import VoiceResponse

from app.config import settings
from app.database import get_db
from app.models import Call, User
from app.phone import normalize_number
from app.security import current_user
from app.services import call_flow, reporting, twilio_service
from app.services.public_url import public_base_url

logger = logging.getLogger("callshield.webhooks")

router = APIRouter(prefix="/twilio", tags=["twilio"])


def _xml(twiml: str) -> Response:
    return Response(content=twiml, media_type="application/xml")


def _goodbye(text: str = "This number is not set up yet. Goodbye.") -> Response:
    response = VoiceResponse()
    response.say(text, voice=settings.TWILIO_VOICE, language="en-IN")
    response.hangup()
    return _xml(str(response))


async def twilio_form(request: Request) -> dict[str, str]:
    """Read the webhook form and reject requests that were not signed by Twilio."""
    form = {key: str(value) for key, value in (await request.form()).items()}
    if not (settings.TWILIO_VALIDATE_SIGNATURE and settings.TWILIO_AUTH_TOKEN):
        return form
    signature = request.headers.get("X-Twilio-Signature", "")
    path_and_query = request.url.path + (f"?{request.url.query}" if request.url.query else "")
    candidates = []
    base = public_base_url()
    if base:
        candidates.append(base + path_and_query)
    host = request.headers.get("x-forwarded-host") or request.headers.get("host")
    if host:
        proto = request.headers.get("x-forwarded-proto", "https")
        candidates.append(f"{proto}://{host}{path_and_query}")
    candidates.append(str(request.url))
    validator = RequestValidator(settings.TWILIO_AUTH_TOKEN)
    if not any(validator.validate(url, form, signature) for url in candidates):
        logger.warning("Rejected webhook with an invalid Twilio signature: %s", request.url.path)
        raise HTTPException(status_code=403, detail="Invalid Twilio signature")
    return form


def _load(db: Session, call_id: int) -> tuple[Call, User] | None:
    call = db.get(Call, call_id)
    if call is None:
        return None
    return call, db.get(User, call.user_id)


def _deliver(background: BackgroundTasks, result: call_flow.FlowResult) -> Response:
    for report_id in result.reports_to_deliver:
        background.add_task(reporting.deliver, report_id)
    return _xml(result.twiml)


@router.post("/voice")
def incoming(background: BackgroundTasks, form: dict = Depends(twilio_form), db: Session = Depends(get_db)):
    call_sid = form.get("CallSid", "")
    sender = form.get("From", "")
    if not call_sid:
        raise HTTPException(status_code=400, detail="Missing CallSid")

    if sender.startswith("client:"):
        channel = "browser"
        identity = sender.removeprefix("client:")
        user_id = identity.removeprefix("user-")
        user = db.get(User, int(user_id)) if user_id.isdigit() else None
        caller_number = normalize_number(form.get("callerNumber")) or "Unknown"
    else:
        channel = "phone"
        user = db.query(User).filter(User.line_number == normalize_number(form.get("To"))).first()
        caller_number = normalize_number(sender) or sender or "Unknown"

    if user is None:
        return _goodbye()

    call = db.query(Call).filter(Call.twilio_sid == call_sid).first()
    if call is None:
        call = Call(user_id=user.id, twilio_sid=call_sid, channel=channel, caller_number=caller_number)
        db.add(call)
        db.commit()
    return _deliver(background, call_flow.start_call(db, user, call))


@router.post("/language")
def language(
    call: int = Query(...),
    digits_query: str | None = Query(default=None, alias="Digits"),
    form: dict = Depends(twilio_form),
    db: Session = Depends(get_db),
):
    loaded = _load(db, call)
    if not loaded:
        return _goodbye("Goodbye.")
    call_row, user = loaded
    return _xml(call_flow.choose_language(db, call_row, user, form.get("Digits") or digits_query).twiml)


@router.post("/screen")
def screen(
    background: BackgroundTasks,
    call: int = Query(...),
    turn: int = Query(default=1, ge=1, le=10),
    retry: int = Query(default=0),
    form: dict = Depends(twilio_form),
    db: Session = Depends(get_db),
):
    loaded = _load(db, call)
    if not loaded:
        return _goodbye("Goodbye.")
    call_row, user = loaded
    try:
        confidence = float(form["Confidence"]) if form.get("Confidence") else None
    except ValueError:
        confidence = None
    result = call_flow.handle_speech(db, call_row, user, form.get("SpeechResult"), confidence, turn, bool(retry))
    return _deliver(background, result)


@router.post("/whisper")
def whisper(call: int = Query(...), form: dict = Depends(twilio_form), db: Session = Depends(get_db)):
    loaded = _load(db, call)
    if not loaded:
        return _xml(str(VoiceResponse()))
    return _xml(call_flow.whisper_twiml(loaded[0]))


@router.post("/dial-result")
def dial_result(call: int = Query(...), form: dict = Depends(twilio_form), db: Session = Depends(get_db)):
    loaded = _load(db, call)
    if not loaded:
        return _goodbye("Goodbye.")
    call_row, user = loaded
    return _xml(call_flow.handle_dial_result(db, call_row, user, form.get("DialCallStatus")).twiml)


@router.post("/voicemail")
def voicemail(call: int = Query(...), form: dict = Depends(twilio_form), db: Session = Depends(get_db)):
    loaded = _load(db, call)
    if not loaded:
        return _goodbye("Goodbye.")
    result = call_flow.handle_recording(db, loaded[0], form.get("RecordingSid"), form.get("RecordingDuration"))
    return _xml(result.twiml)


@router.post("/status")
def status(form: dict = Depends(twilio_form), db: Session = Depends(get_db)):
    call = db.query(Call).filter(Call.twilio_sid == form.get("CallSid", "")).first()
    if call:
        call_flow.handle_status(db, call, form.get("CallStatus", ""), form.get("CallDuration"))
    return {"ok": True}


@router.get("/token")
def browser_token(user: User = Depends(current_user), db: Session = Depends(get_db)):
    try:
        token = twilio_service.access_token(db, identity=f"user-{user.id}")
    except twilio_service.TwilioNotReady as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return {"token": token, "identity": f"user-{user.id}"}
