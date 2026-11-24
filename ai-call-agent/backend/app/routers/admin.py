"""Super admin endpoints: platform overview, user management and every police report."""

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db, utcnow
from app.models import Call, Report, SpamNumber, User
from app.routers.reports import report_out
from app.schemas import AdminOverview, AdminReportRow, AdminRoleIn, AdminUserRow, DayCount
from app.security import current_admin

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/overview", response_model=AdminOverview)
def overview(_: User = Depends(current_admin), db: Session = Depends(get_db)):
    today = (utcnow() + timedelta(minutes=330)).date()
    days = [today - timedelta(days=i) for i in range(6, -1, -1)]
    buckets = {d.isoformat(): {"total": 0, "spam": 0} for d in days}
    since = utcnow() - timedelta(days=8)
    for started_at, verdict in db.query(Call.started_at, Call.verdict).filter(Call.started_at >= since):
        key = (started_at + timedelta(minutes=330)).date().isoformat()
        if key in buckets:
            buckets[key]["total"] += 1
            buckets[key]["spam"] += verdict == "spam"
    return AdminOverview(
        users=db.query(User).count(),
        admins=db.query(User).filter(User.role == "admin").count(),
        calls=db.query(Call).count(),
        scams_blocked=db.query(Call).filter(Call.verdict == "spam").count(),
        reports_sent=db.query(Report).filter(Report.status.in_(("sent", "acknowledged"))).count(),
        reports_acknowledged=db.query(Report).filter(Report.status == "acknowledged").count(),
        reported_numbers=db.query(SpamNumber).count(),
        last_7_days=[DayCount(date=k, **v) for k, v in buckets.items()],
    )


@router.get("/users", response_model=list[AdminUserRow])
def users(_: User = Depends(current_admin), db: Session = Depends(get_db)):
    calls = dict(db.query(Call.user_id, func.count(Call.id)).group_by(Call.user_id).all())
    scams = dict(db.query(Call.user_id, func.count(Call.id)).filter(Call.verdict == "spam").group_by(Call.user_id).all())
    reports = dict(db.query(Report.user_id, func.count(Report.id)).group_by(Report.user_id).all())
    return [
        AdminUserRow(
            id=u.id,
            name=u.name,
            email=u.email,
            role=u.role,
            phone=u.phone,
            address=u.address,
            calls=calls.get(u.id, 0),
            scams=scams.get(u.id, 0),
            reports=reports.get(u.id, 0),
            created_at=u.created_at,
        )
        for u in db.query(User).order_by(User.created_at.desc()).all()
    ]


@router.patch("/users/{user_id}", response_model=AdminUserRow)
def change_role(user_id: int, body: AdminRoleIn, admin: User = Depends(current_admin), db: Session = Depends(get_db)):
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == admin.id and body.role != "admin":
        raise HTTPException(status_code=400, detail="You cannot remove your own admin role")
    target.role = body.role
    db.commit()
    return next(row for row in users(admin, db) if row.id == target.id)


@router.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: int, admin: User = Depends(current_admin), db: Session = Depends(get_db)):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(target)
    db.commit()


@router.get("/reports", response_model=list[AdminReportRow])
def all_reports(
    limit: int = Query(default=200, ge=1, le=1000),
    _: User = Depends(current_admin),
    db: Session = Depends(get_db),
):
    rows = db.query(Report).order_by(Report.created_at.desc()).limit(limit).all()
    return [
        AdminReportRow(**report_out(r).model_dump(), user_name=r.user.name, user_email=r.user.email)
        for r in rows
    ]
