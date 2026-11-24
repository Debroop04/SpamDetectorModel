from collections import Counter, defaultdict

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.formatting import display_number
from app.models import NumberReport, NumberRule, SpamNumber, User
from app.phone import normalize_number
from app.routers.reports import report_out
from app.schemas import HotspotOut, ManualReportIn, ManualReportOut, NumberLookupOut, RuleIn, RuleOut, SpamNumberOut
from app.security import current_user
from app.services import detector, reporting

router = APIRouter(prefix="/numbers", tags=["numbers"])


def _normalized(raw: str) -> str:
    number = normalize_number(raw)
    if not number:
        raise HTTPException(status_code=422, detail="Enter a valid phone number")
    return number


@router.get("/lookup", response_model=NumberLookupOut)
def lookup(number: str = Query(..., min_length=6, max_length=32), user: User = Depends(current_user), db: Session = Depends(get_db)):
    normalized = _normalized(number)
    row = db.get(SpamNumber, normalized)
    rule = db.query(NumberRule).filter_by(user_id=user.id, number=normalized).first()
    reports = row.reports if row else 0
    risk = detector.reputation_score(reports)
    level = "unknown" if reports == 0 else ("dangerous" if risk >= 0.75 else "reported")
    return NumberLookupOut(
        number=normalized,
        reports=reports,
        category=row.category if row else None,
        risk=round(risk, 2),
        level=level,
        last_reported_at=row.last_reported_at if row else None,
        rule=rule.kind if rule else None,
    )


@router.get("/top", response_model=list[SpamNumberOut])
def top(limit: int = Query(default=25, ge=1, le=100), _: User = Depends(current_user), db: Session = Depends(get_db)):
    return db.query(SpamNumber).order_by(SpamNumber.reports.desc(), SpamNumber.last_reported_at.desc()).limit(limit).all()


@router.post("/report", response_model=ManualReportOut)
def report_number(
    body: ManualReportIn,
    background: BackgroundTasks,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Report a number that called the user directly (outside the protection line)."""
    number = _normalized(body.number)
    counted = reporting.record_number_report(db, user, number, body.category, note=body.note)
    out = ManualReportOut(number=number, counted=counted)
    if body.send_to_police:
        summary = f"{user.name} received a fraudulent call from {display_number(number)} ({body.category})."
        if body.note:
            summary += f" Details from the complainant: {body.note.strip()}"
        report, created = reporting.create_report(
            db, user, caller_number=number, category=body.category, summary=summary, source="manual"
        )
        if created:
            background.add_task(reporting.deliver, report.id)
        out.report = report_out(report)
        out.duplicate_report = not created
    return out


@router.get("/hotspots", response_model=list[HotspotOut])
def hotspots(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(default=25, ge=1, le=200),
    _: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Approximate places where spam calls were reported (grouped into about 1 km cells)."""
    delta = radius_km / 111.0
    rows = (
        db.query(NumberReport)
        .filter(NumberReport.approx_lat.between(lat - delta, lat + delta))
        .filter(NumberReport.approx_lng.between(lng - delta * 1.6, lng + delta * 1.6))
        .all()
    )
    cells: dict[tuple[float, float], Counter] = defaultdict(Counter)
    for row in rows:
        cells[(row.approx_lat, row.approx_lng)][row.category] += 1
    return [
        HotspotOut(lat=key[0], lng=key[1], count=sum(counter.values()), category=counter.most_common(1)[0][0])
        for key, counter in cells.items()
    ]


@router.get("/rules", response_model=list[RuleOut])
def list_rules(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return db.query(NumberRule).filter_by(user_id=user.id).order_by(NumberRule.created_at.desc()).all()


@router.put("/rules", response_model=RuleOut)
def set_rule(body: RuleIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    number = _normalized(body.number)
    rule = db.query(NumberRule).filter_by(user_id=user.id, number=number).first()
    if rule is None:
        rule = NumberRule(user_id=user.id, number=number, kind=body.kind)
        db.add(rule)
    rule.kind = body.kind
    db.commit()
    return rule


@router.delete("/rules/{number}", status_code=204)
def delete_rule(number: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.query(NumberRule).filter_by(user_id=user.id, number=_normalized(number)).delete()
    db.commit()
