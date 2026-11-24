"""Police complaint creation and email delivery."""

import logging
import secrets
from datetime import timedelta
from xml.sax.saxutils import escape

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal, utcnow
from app.events import broker
from app.formatting import display_number, percent
from app.models import Call, NumberReport, Report, User
from app.phone import normalize_number
from app.services import geo
from app.services.detector import add_community_report
from app.services.mailer import MailNotConfigured, send_email
from app.services.pdf import build_report_pdf
from app.services.public_url import public_base_url

logger = logging.getLogger("callshield.reporting")

DEDUPE_WINDOW = timedelta(hours=24)
IST = timedelta(hours=5, minutes=30)


def effective_mode(user: User) -> str:
    return "live" if user.police_delivery == "live" and settings.ALLOW_LIVE_POLICE_EMAIL else "test"


def report_public_url(report: Report) -> str | None:
    base = public_base_url()
    return f"{base}/r/{report.ack_token}" if base else None


def serialize_report(report: Report) -> dict:
    return {
        "id": report.id,
        "reference": report.reference,
        "status": report.status,
        "mode": report.mode,
        "caller_number": report.caller_number,
        "category": report.category,
        "station_name": report.station_name,
        "sent_to": report.sent_to,
        "acknowledged_at": report.acknowledged_at,
        "call_id": report.call_id,
    }


def record_number_report(
    db: Session,
    user: User,
    number: str,
    category: str,
    note: str | None = None,
    call_id: int | None = None,
    source: str = "community",
) -> bool:
    """Store one report per user per number and raise the number's community reputation. Returns True if new."""
    normalized = normalize_number(number)
    if not normalized:
        return False
    if db.query(NumberReport).filter_by(user_id=user.id, number=normalized).first():
        return False
    db.add(
        NumberReport(
            number=normalized,
            user_id=user.id,
            call_id=call_id,
            category=category,
            note=note,
            approx_lat=round(user.lat, 2) if user.lat is not None else None,
            approx_lng=round(user.lng, 2) if user.lng is not None else None,
        )
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return False
    add_community_report(db, normalized, category, source=source)
    return True


def create_report(
    db: Session,
    user: User,
    *,
    caller_number: str,
    category: str,
    summary: str,
    source: str,
    call: Call | None = None,
    risk_score: float | None = None,
) -> tuple[Report, bool]:
    """Create a complaint unless one exists for this number in the last 24 hours. Returns (report, created)."""
    number = normalize_number(caller_number) or caller_number
    recent = (
        db.query(Report)
        .filter(Report.user_id == user.id, Report.caller_number == number, Report.created_at >= utcnow() - DEDUPE_WINDOW)
        .order_by(Report.id.desc())
        .first()
    )
    if recent:
        if call and recent.call_id is None:
            recent.call_id = call.id
            db.commit()
        return recent, False

    report = Report(
        user_id=user.id,
        call_id=call.id if call else None,
        source=source,
        caller_number=number,
        category=category,
        summary=summary,
        risk_score=risk_score,
        lat=user.lat,
        lng=user.lng,
        address=user.address,
        status="queued",
        mode=effective_mode(user),
        ack_token=secrets.token_urlsafe(24),
    )
    db.add(report)
    db.commit()
    broker.publish(user.id, "report.created", serialize_report(report))
    return report, True


def _assign_station(db: Session, report: Report) -> None:
    user = report.user
    station = user.station
    if station is None and user.lat is not None:
        picked = geo.pick_station(geo.nearby_stations(db, user.lat, user.lng))
        if picked:
            station = picked.station
            user.station_id = station.id
            db.commit()
    if station is None:
        return
    report.station_name = station.name
    report.station_lat = station.lat
    report.station_lng = station.lng
    report.station_phone = station.phone
    report.station_address = station.address
    report.station_email = station.email
    if user.lat is not None:
        report.distance_km = round(geo.haversine_km(user.lat, user.lng, station.lat, station.lng), 2)


def _when(report: Report) -> str:
    moment = report.call.started_at if report.call else report.created_at
    return (moment + IST).strftime("%d %b %Y, %I:%M %p IST")


def compose_email(report: Report, public_url: str | None, police_email: str | None) -> tuple[str, str, str]:
    user = report.user
    station = report.station_name or "the nearest police station"
    test = report.mode == "test"
    subject = f"{'[TEST] ' if test else ''}Fraud call complaint {report.reference}: {display_number(report.caller_number)}"

    caller_lines = []
    if report.call:
        caller_lines = [t.text_en or t.text for t in report.call.turns if t.speaker == "caller"][:4]
    map_link = (
        f"https://www.openstreetmap.org/?mlat={report.lat}&mlon={report.lng}#map=16/{report.lat}/{report.lng}"
        if report.lat is not None
        else None
    )
    facts = [
        ("Reference", report.reference),
        ("Caller number", display_number(report.caller_number)),
        ("Time of call", _when(report)),
        ("Type of fraud", report.category),
        ("Risk score", percent(report.risk_score) if report.risk_score is not None else "Reported by user"),
        ("Complainant", user.name),
        ("Complainant phone", display_number(user.phone) if user.phone else "Not provided"),
        ("Complainant email", user.email),
        ("Location", report.address or (f"{report.lat:.5f}, {report.lng:.5f}" if report.lat is not None else "Not provided")),
        ("Police station", f"{station}" + (f" ({report.distance_km:.1f} km away)" if report.distance_km is not None else "")),
    ]

    text_lines = []
    if test:
        text_lines += [
            "TEST MODE: this email was sent to you instead of the police station.",
            f"In live mode it goes to: {police_email or 'no station email on file'}",
            "",
        ]
    text_lines += [
        f"A call to {user.name} was identified as a likely fraud attempt and is reported to {station}.",
        "",
        *[f"{label}: {value}" for label, value in facts],
        "",
        "What the caller said:",
        *[f"- {line}" for line in caller_lines or ["(reported manually, no transcript)"]],
        "",
        f"Summary: {report.summary}",
    ]
    if public_url:
        text_lines += ["", f"Open the report and acknowledge receipt: {public_url}"]
    text_lines += ["", "The complaint PDF is attached. Reply to this email to contact the complainant.", "National Cyber Crime Helpline: 1930 | cybercrime.gov.in"]
    text = "\n".join(text_lines)

    rows = "".join(
        f'<tr><td style="padding:10px 0;border-bottom:1px solid #E2E8F0;color:#64748B;width:170px;vertical-align:top">{escape(label)}</td>'
        f'<td style="padding:10px 0;border-bottom:1px solid #E2E8F0;color:#0F172A;vertical-align:top">{escape(str(value))}</td></tr>'
        for label, value in facts
    )
    quotes = "".join(
        f'<p style="margin:0 0 8px;padding:10px 12px;background:#F1F5F9;border-radius:6px;color:#0F172A">{escape(line)}</p>'
        for line in caller_lines
    )
    notice = (
        '<div style="margin:0 0 20px;padding:12px 14px;border:1px solid #FCD34D;background:#FFFBEB;border-radius:8px;color:#92400E">'
        "<strong>Test mode.</strong> This email was sent to you instead of the police station. "
        f"In live mode it goes to: {escape(police_email or 'no station email on file')}</div>"
        if test
        else ""
    )
    button = (
        f'<a href="{escape(public_url)}" style="display:inline-block;background:#1D4ED8;color:#FFFFFF;text-decoration:none;'
        'padding:12px 18px;border-radius:8px;font-weight:600">Open report and acknowledge</a>'
        if public_url
        else ""
    )
    map_html = f'<a href="{escape(map_link)}" style="color:#1D4ED8">View location on map</a>' if map_link else ""
    html = f"""<!doctype html><html><body style="margin:0;background:#F8FAFC;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px">
<tr><td style="padding:18px 28px;background:#0F172A;border-radius:12px 12px 0 0;color:#FFFFFF;font-weight:700;font-size:15px">Call Shield</td></tr>
<tr><td style="padding:28px">
{notice}
<h1 style="margin:0 0 12px;font-size:20px;color:#0F172A">Fraud call complaint</h1>
<p style="margin:0 0 20px;color:#334155">A call to <strong>{escape(user.name)}</strong> was identified as a likely fraud attempt and is reported to <strong>{escape(station)}</strong>. The complaint PDF is attached.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">{rows}</table>
<p style="margin:16px 0 0">{map_html}</p>
{"<h2 style='margin:24px 0 10px;font-size:15px;color:#0F172A'>What the caller said</h2>" + quotes if quotes else ""}
<p style="margin:20px 0 24px;color:#334155">{escape(report.summary)}</p>
{button}
</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #E2E8F0;color:#64748B;font-size:12px">Reply to this email to contact the complainant directly. National Cyber Crime Helpline: <strong style="color:#B91C1C">1930</strong> | cybercrime.gov.in</td></tr>
</table></td></tr></table></body></html>"""
    return subject, text, html


def deliver(report_id: int) -> None:
    """Resolve the police station and send the complaint email. Runs in a background thread."""
    db = SessionLocal()
    try:
        report = db.get(Report, report_id)
        if report is None or report.status == "acknowledged":
            return
        user = report.user
        report.mode = effective_mode(user)
        try:
            _assign_station(db, report)
        except Exception as exc:
            logger.warning("Station lookup failed for report %s: %s", report.id, exc)

        police_email = report.station_email or settings.FALLBACK_POLICE_EMAIL or None
        if report.station_email is None and police_email:
            report.station_email = police_email

        if report.mode == "live":
            if not police_email:
                report.status = "needs_email"
                report.error = "No email address is known for this police station. Add one in Settings."
                db.commit()
                broker.publish(user.id, "report.updated", serialize_report(report))
                return
            to, cc = [police_email], [user.email]
        else:
            to, cc = [user.email], None

        public_url = report_public_url(report)
        try:
            pdf = build_report_pdf(report, public_url)
            subject, text, html = compose_email(report, public_url, police_email)
            send_email(
                to=to,
                cc=cc,
                subject=subject,
                text=text,
                html=html,
                reply_to=user.email,
                attachments=[(f"{report.reference}.pdf", pdf, "application/pdf")],
            )
            report.status = "sent"
            report.sent_to = ", ".join(to)
            report.sent_at = utcnow()
            report.error = None
        except MailNotConfigured as exc:
            report.status = "failed"
            report.error = str(exc)
        except Exception as exc:
            logger.exception("Sending report %s failed", report.id)
            report.status = "failed"
            report.error = f"Email could not be sent: {exc}"
        db.commit()
        broker.publish(user.id, "report.updated", serialize_report(report))
    finally:
        db.close()


def acknowledge(db: Session, report: Report, officer: str | None, note: str | None) -> Report:
    if report.status != "acknowledged":
        report.status = "acknowledged"
        report.acknowledged_at = utcnow()
        report.ack_by = (officer or "").strip()[:120] or None
        report.ack_note = (note or "").strip()[:2000] or None
        db.commit()
        broker.publish(report.user_id, "report.updated", serialize_report(report))
    return report
