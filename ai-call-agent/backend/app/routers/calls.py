from datetime import timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db, utcnow
from app.formatting import display_number
from app.models import Call, NumberReport, NumberRule, Report, User
from app.schemas import CallDetail, CallOut, CallPage, ReportBrief, ReportOut
from app.security import current_user, current_user_flexible
from app.services import call_flow, reporting, twilio_service
from app.routers.reports import report_out

router = APIRouter(prefix="/calls", tags=["calls"])

LIVE_STATUSES = ("screening", "forwarding")


def _own_call(db: Session, user: User, call_id: int) -> Call:
    call = db.get(Call, call_id)
    if call is None or call.user_id != user.id:
        raise HTTPException(status_code=404, detail="Call not found")
    return call


def call_out(call: Call) -> CallOut:
    out = CallOut.model_validate(call)
    out.has_recording = bool(call.recording_sid)
    return out


@router.get("", response_model=CallPage)
def list_calls(
    verdict: str | None = Query(default=None),
    q: str | None = Query(default=None, max_length=64),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Call).filter(Call.user_id == user.id)
    if verdict in ("safe", "suspicious", "spam", "pending"):
        query = query.filter(Call.verdict == verdict)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(or_(Call.caller_number.like(like), Call.caller_name.like(like), Call.category.like(like)))
    total = query.count()
    rows = query.order_by(Call.started_at.desc()).offset(offset).limit(limit).all()
    return CallPage(items=[call_out(c) for c in rows], total=total)


@router.get("/live", response_model=list[CallOut])
def live_calls(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = (
        db.query(Call)
        .filter(Call.user_id == user.id, Call.status.in_(LIVE_STATUSES), Call.started_at >= utcnow() - timedelta(minutes=15))
        .order_by(Call.started_at.desc())
        .all()
    )
    return [call_out(c) for c in rows]


@router.get("/{call_id}", response_model=CallDetail)
def call_detail(call_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    call = _own_call(db, user, call_id)
    detail = CallDetail.model_validate(call)
    detail.has_recording = bool(call.recording_sid)
    report = db.query(Report).filter(Report.call_id == call.id).order_by(Report.id.desc()).first()
    detail.report = ReportBrief.model_validate(report) if report else None
    rule = db.query(NumberRule).filter_by(user_id=user.id, number=call.caller_number).first()
    detail.rule = rule.kind if rule else None
    detail.number_reports = db.query(NumberReport).filter(NumberReport.number == call.caller_number).count()
    return detail


@router.get("/{call_id}/recording")
def recording(call_id: int, user: User = Depends(current_user_flexible), db: Session = Depends(get_db)):
    call = _own_call(db, user, call_id)
    if not call.recording_sid:
        raise HTTPException(status_code=404, detail="No recording for this call")
    try:
        upstream = twilio_service.fetch_recording(call.recording_sid)
    except twilio_service.TwilioNotReady as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    if upstream.status_code != 200:
        raise HTTPException(status_code=502, detail="Could not fetch the recording from Twilio")
    return Response(content=upstream.content, media_type="audio/mpeg", headers={"Cache-Control": "private, max-age=3600"})


@router.post("/{call_id}/block", response_model=CallOut)
def block_call(
    call_id: int,
    background: BackgroundTasks,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """End a call that is still being screened and report it."""
    call = _own_call(db, user, call_id)
    if call.status not in LIVE_STATUSES:
        raise HTTPException(status_code=409, detail="This call has already ended")
    try:
        twilio_service.redirect_call(call.twilio_sid, call_flow.hangup_twiml(call_flow.prompt(call.language, "blocked_detected"), call.language))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not end the call: {exc}")
    for report_id in call_flow.block_live_call(db, call, user):
        background.add_task(reporting.deliver, report_id)
    return call_out(call)


@router.post("/{call_id}/connect", response_model=CallOut)
def connect_call(call_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Skip the rest of screening and ring the user's phone now."""
    call = _own_call(db, user, call_id)
    if call.status != "screening":
        raise HTTPException(status_code=409, detail="This call is no longer being screened")
    if not user.phone:
        raise HTTPException(status_code=400, detail="Add your phone number in Settings first")
    try:
        twilio_service.redirect_call(call.twilio_sid, call_flow.forward_twiml(call, user))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not connect the call: {exc}")
    call.status = "forwarding"
    call.reasons = (call.reasons or []) + ["You chose to take this call."]
    db.commit()
    call_flow.publish_call(call)
    return call_out(call)


@router.post("/{call_id}/report", response_model=ReportOut)
def report_call(
    call_id: int,
    background: BackgroundTasks,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    call = _own_call(db, user, call_id)
    if not call.caller_number.startswith("+"):
        raise HTTPException(status_code=400, detail="This call has no caller number to report")
    category = call.category or "Scam call"
    reporting.record_number_report(db, user, call.caller_number, category, call_id=call.id)
    caller_lines = [t.text_en or t.text for t in call.turns if t.speaker == "caller"]
    summary = f"{user.name} reported a call from {display_number(call.caller_number)} as {category}." + (
        f' The caller said: "{caller_lines[0][:240]}"' if caller_lines else ""
    )
    report, created = reporting.create_report(
        db, user, caller_number=call.caller_number, category=category, summary=summary,
        source="user", call=call, risk_score=call.risk_score,
    )
    if created or report.status in ("failed", "needs_email"):
        background.add_task(reporting.deliver, report.id)
    return report_out(report)
