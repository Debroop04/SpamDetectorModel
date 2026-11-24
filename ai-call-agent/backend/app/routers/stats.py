from datetime import timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db, utcnow
from app.models import Call, Report, User
from app.schemas import DayCount, StatsOut
from app.security import current_user

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("", response_model=StatsOut)
def overview(
    tz_offset_minutes: int = Query(default=330, ge=-720, le=840),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    calls = db.query(Call).filter(Call.user_id == user.id)
    reports = db.query(Report).filter(Report.user_id == user.id)

    offset = timedelta(minutes=tz_offset_minutes)
    today = (utcnow() + offset).date()
    days = [today - timedelta(days=i) for i in range(6, -1, -1)]
    since = utcnow() - timedelta(days=8)
    buckets = {d.isoformat(): {"total": 0, "spam": 0} for d in days}
    for started_at, verdict in calls.filter(Call.started_at >= since).with_entities(Call.started_at, Call.verdict):
        key = (started_at + offset).date().isoformat()
        if key in buckets:
            buckets[key]["total"] += 1
            if verdict == "spam":
                buckets[key]["spam"] += 1

    categories = (
        calls.filter(Call.verdict == "spam", Call.category.isnot(None))
        .with_entities(Call.category, func.count(Call.id))
        .group_by(Call.category)
        .order_by(func.count(Call.id).desc())
        .limit(5)
        .all()
    )

    return StatsOut(
        screened=calls.count(),
        blocked=calls.filter(Call.verdict == "spam").count(),
        safe=calls.filter(Call.verdict == "safe").count(),
        connected=calls.filter(Call.status == "connected").count(),
        suspicious=calls.filter(Call.verdict == "suspicious").count(),
        reports_sent=reports.filter(Report.status.in_(("sent", "acknowledged"))).count(),
        reports_acknowledged=reports.filter(Report.status == "acknowledged").count(),
        last_7_days=[DayCount(date=k, **v) for k, v in buckets.items()],
        top_categories=[{"category": c, "count": n} for c, n in categories],
    )
