"""Complaint PDF generator."""

from datetime import timedelta
from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.formatting import display_number, percent
from app.models import Report

INK = colors.HexColor("#0F172A")
MUTED = colors.HexColor("#64748B")
LINE = colors.HexColor("#E2E8F0")
ACCENT = colors.HexColor("#1D4ED8")
DANGER = colors.HexColor("#B91C1C")
IST = timedelta(hours=5, minutes=30)

_title = ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=17, leading=22, textColor=INK)
_meta = ParagraphStyle("meta", fontName="Helvetica", fontSize=9, leading=13, textColor=MUTED)
_section = ParagraphStyle("section", fontName="Helvetica-Bold", fontSize=10.5, leading=14, textColor=ACCENT, spaceBefore=10, spaceAfter=4)
_body = ParagraphStyle("body", fontName="Helvetica", fontSize=9.5, leading=13.5, textColor=INK, alignment=TA_LEFT)
_label = ParagraphStyle("label", parent=_body, textColor=MUTED)
_small = ParagraphStyle("small", parent=_body, fontSize=8.5, leading=12, textColor=MUTED)


def _p(text: str | None, style: ParagraphStyle = _body) -> Paragraph:
    return Paragraph(escape(text or "-").replace("\n", "<br/>"), style)


def _ist(value) -> str:
    if value is None:
        return "-"
    return (value + IST).strftime("%d %b %Y, %I:%M %p IST")


def _rows(pairs: list[tuple[str, str | None]]) -> Table:
    table = Table([[_p(k, _label), _p(v)] for k, v in pairs], colWidths=[42 * mm, 128 * mm])
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LINEBELOW", (0, 0), (-1, -1), 0.5, LINE),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return table


def build_report_pdf(report: Report, public_url: str | None) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=f"Complaint {report.reference}",
        author="Call Shield",
    )
    user = report.user
    call = report.call
    story = [
        Paragraph("Complaint: fraudulent phone call", _title),
        Spacer(1, 3),
        _p(f"Reference {report.reference}  |  Filed {_ist(report.created_at)}", _meta),
        Spacer(1, 10),
        _p(
            "This complaint was generated automatically by Call Shield on behalf of the complainant after a call "
            "to their number was screened and identified as a likely fraud attempt. The complainant can be "
            "contacted directly using the details below.",
            _small,
        ),
        Paragraph("Complainant", _section),
        _rows(
            [
                ("Name", user.name),
                ("Email", user.email),
                ("Phone", display_number(user.phone) if user.phone else None),
                ("Address", report.address),
                ("Coordinates", f"{report.lat:.5f}, {report.lng:.5f}" if report.lat is not None else None),
            ]
        ),
        Paragraph("Incident", _section),
        _rows(
            [
                ("Caller number", display_number(report.caller_number)),
                ("Date and time", _ist(call.started_at if call else report.created_at)),
                ("Type of fraud", report.category),
                ("Risk score", percent(report.risk_score) if report.risk_score is not None else None),
                ("Summary", report.summary),
            ]
        ),
    ]

    if call and call.reasons:
        story.append(Paragraph("Why the call was flagged", _section))
        story.append(_p("\n".join(f"- {reason}" for reason in call.reasons)))

    if call and call.turns:
        story.append(Paragraph("Call transcript", _section))
        lines = []
        for turn in call.turns:
            speaker = "Assistant" if turn.speaker == "assistant" else "Caller"
            text = turn.text_en or turn.text
            if turn.text_en and turn.text_en != turn.text:
                text = f"{turn.text_en} (translated from Hindi)"
            if text.isascii():
                lines.append([_p(speaker, _label), _p(text)])
        if lines:
            table = Table(lines, colWidths=[24 * mm, 146 * mm])
            table.setStyle(
                TableStyle(
                    [
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("TOPPADDING", (0, 0), (-1, -1), 3),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                        ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ]
                )
            )
            story.append(table)

    story += [
        Paragraph("Addressed to", _section),
        _rows(
            [
                ("Police station", report.station_name),
                ("Station address", report.station_address),
                ("Station phone", report.station_phone),
                ("Distance", f"{report.distance_km:.1f} km from complainant" if report.distance_km is not None else None),
            ]
        ),
    ]
    if public_url:
        story += [
            Paragraph("Online copy", _section),
            _p(f"View this report and acknowledge receipt: {public_url}"),
        ]
    story += [
        Spacer(1, 14),
        Paragraph(
            "National Cyber Crime Helpline: <b>1930</b>  |  cybercrime.gov.in",
            ParagraphStyle("help", parent=_body, textColor=DANGER),
        ),
    ]
    doc.build(story)
    return buffer.getvalue()
