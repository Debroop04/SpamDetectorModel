"""Pages the police station opens from the complaint email. No login needed; the link token is the key."""

import json
from datetime import timedelta
from html import escape
from pathlib import Path
from string import Template

from fastapi import APIRouter, Depends, Form, HTTPException, Response
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.formatting import display_number, percent
from app.models import Report
from app.services import reporting
from app.services.pdf import build_report_pdf

router = APIRouter(tags=["public"])

TEMPLATE = Template((Path(__file__).resolve().parent.parent / "templates" / "public_report.html").read_text(encoding="utf-8"))
IST = timedelta(hours=5, minutes=30)


def _report(db: Session, token: str) -> Report:
    report = db.query(Report).filter(Report.ack_token == token).first()
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


def _ist(value) -> str:
    return (value + IST).strftime("%d %b %Y, %I:%M %p IST") if value else "-"


def render(report: Report, just_acknowledged: bool = False) -> str:
    user = report.user
    call = report.call
    e = lambda v: escape(str(v)) if v not in (None, "") else "-"  # noqa: E731

    if report.status == "acknowledged":
        status_class, status_label = "ok", "Acknowledged"
        ack_block = (
            '<section class="card done"><h2>Receipt acknowledged</h2>'
            f"<div>Acknowledged {e(_ist(report.acknowledged_at))}"
            + (f" by {e(report.ack_by)}" if report.ack_by else "")
            + "</div>"
            + (f'<p style="margin:10px 0 0">{e(report.ack_note)}</p>' if report.ack_note else "")
            + ("<p style='margin:10px 0 0;color:#15803D;font-weight:600'>Thank you. The complainant has been notified.</p>" if just_acknowledged else "")
            + "</section>"
        )
    else:
        status_class, status_label = "danger", "Awaiting acknowledgement"
        ack_block = (
            '<section class="card"><h2>Acknowledge this complaint</h2>'
            f'<form method="post" action="/r/{e(report.ack_token)}/ack">'
            '<div class="field"><label for="officer">Officer name and rank</label><input id="officer" name="officer" maxlength="120" placeholder="e.g. SI R. Sharma"></div>'
            '<div class="field"><label for="note">Note for the complainant</label><textarea id="note" name="note" maxlength="2000" placeholder="Optional"></textarea></div>'
            '<button class="btn" type="submit">Acknowledge receipt</button></form></section>'
        )

    mode_notice = (
        '<section class="card notice"><strong>Test report.</strong> This complaint was sent in test mode and did not go to a police station.</section>'
        if report.mode == "test"
        else ""
    )

    reasons = call.reasons if call and call.reasons else []
    reasons_block = (
        '<section class="card"><h2>Why the call was flagged</h2><ul class="reasons">'
        + "".join(f"<li>{e(r)}</li>" for r in reasons)
        + "</ul></section>"
        if reasons
        else ""
    )

    turns = call.turns if call else []
    transcript_block = (
        '<section class="card"><h2>Call transcript</h2>'
        + "".join(
            f'<div class="turn"><div class="who {"caller" if t.speaker == "caller" else ""}">{"Caller" if t.speaker == "caller" else "Assistant"}</div>'
            f"<div>{e(t.text)}"
            + (f'<div class="meta">{e(t.text_en)}</div>' if t.text_en and t.text_en != t.text else "")
            + "</div></div>"
            for t in turns
        )
        + "</section>"
        if turns
        else ""
    )

    points = []
    if report.lat is not None:
        points.append({"lat": report.lat, "lng": report.lng, "label": "Complainant (approximate)"})
    if report.station_lat is not None:
        points.append({"lat": report.station_lat, "lng": report.station_lng, "label": report.station_name or "Police station"})
    map_block = '<section class="card"><h2>Location</h2><div id="map"></div></section>' if points else ""
    map_script = (
        '<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script><script>'
        f"var pts={json.dumps(points)};"
        "var map=L.map('map',{scrollWheelZoom:false});"
        "L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',{attribution:'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors',maxNativeZoom:16,maxZoom:19}).addTo(map);"
        "L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',{maxNativeZoom:16,maxZoom:19}).addTo(map);"
        "var colors=['#B91C1C','#1D4ED8'];var ll=[];"
        "pts.forEach(function(p,i){var m=L.circleMarker([p.lat,p.lng],{radius:9,color:'#fff',weight:2,fillColor:colors[i]||'#1D4ED8',fillOpacity:1}).addTo(map).bindTooltip(p.label);ll.push([p.lat,p.lng]);});"
        "if(ll.length>1){L.polyline(ll,{color:'#1D4ED8',weight:2,dashArray:'6 6'}).addTo(map);map.fitBounds(ll,{padding:[40,40]});}else{map.setView(ll[0],15);}"
        "</script>"
        if points
        else ""
    )

    station = report.station_name or "-"
    if report.distance_km is not None:
        station += f" ({report.distance_km:.1f} km away)"

    return TEMPLATE.safe_substitute(
        reference=e(report.reference),
        filed_at=e(_ist(report.created_at)),
        status_class=status_class,
        status_label=status_label,
        mode_notice=mode_notice,
        ack_block=ack_block,
        caller_number=e(display_number(report.caller_number)),
        call_time=e(_ist(call.started_at if call else report.created_at)),
        category=e(report.category),
        risk=percent(report.risk_score) if report.risk_score is not None else "Reported by the complainant",
        summary=e(report.summary),
        user_name=e(user.name),
        user_phone=e(display_number(user.phone) if user.phone else None),
        user_email=e(user.email),
        address=e(report.address or (f"{report.lat:.5f}, {report.lng:.5f}" if report.lat is not None else None)),
        station=e(station),
        map_block=map_block,
        reasons_block=reasons_block,
        transcript_block=transcript_block,
        pdf_url=f"/r/{e(report.ack_token)}/pdf",
        map_script=map_script,
    )


@router.get("/r/{token}", response_class=HTMLResponse)
def view(token: str, done: int = 0, db: Session = Depends(get_db)):
    return HTMLResponse(render(_report(db, token), just_acknowledged=bool(done)))


@router.post("/r/{token}/ack")
def ack(token: str, officer: str = Form(default=""), note: str = Form(default=""), db: Session = Depends(get_db)):
    report = _report(db, token)
    reporting.acknowledge(db, report, officer, note)
    return RedirectResponse(url=f"/r/{token}?done=1", status_code=303)


@router.get("/r/{token}/pdf")
def pdf(token: str, db: Session = Depends(get_db)):
    report = _report(db, token)
    return Response(
        content=build_report_pdf(report, reporting.report_public_url(report)),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{report.reference}.pdf"'},
    )
