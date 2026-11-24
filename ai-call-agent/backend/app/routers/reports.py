from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Report, User
from app.schemas import ReportOut
from app.security import current_user, current_user_flexible
from app.services import reporting
from app.services.pdf import build_report_pdf

router = APIRouter(prefix="/reports", tags=["reports"])


def report_out(report: Report) -> ReportOut:
    out = ReportOut.model_validate(report)
    out.public_url = reporting.report_public_url(report)
    return out


def _own_report(db: Session, user: User, report_id: int) -> Report:
    report = db.get(Report, report_id)
    if report is None or report.user_id != user.id:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.get("", response_model=list[ReportOut])
def list_reports(
    status: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Report).filter(Report.user_id == user.id)
    if status:
        query = query.filter(Report.status == status)
    return [report_out(r) for r in query.order_by(Report.created_at.desc()).limit(limit).all()]


@router.get("/{report_id}", response_model=ReportOut)
def get_report(report_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return report_out(_own_report(db, user, report_id))


@router.get("/{report_id}/pdf")
def report_pdf(report_id: int, user: User = Depends(current_user_flexible), db: Session = Depends(get_db)):
    report = _own_report(db, user, report_id)
    pdf = build_report_pdf(report, reporting.report_public_url(report))
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{report.reference}.pdf"'},
    )


@router.post("/{report_id}/resend", response_model=ReportOut)
def resend(report_id: int, background: BackgroundTasks, user: User = Depends(current_user), db: Session = Depends(get_db)):
    report = _own_report(db, user, report_id)
    if report.status == "acknowledged":
        raise HTTPException(status_code=409, detail="The police station has already acknowledged this report")
    report.status = "queued"
    report.error = None
    db.commit()
    background.add_task(reporting.deliver, report.id)
    return report_out(report)
