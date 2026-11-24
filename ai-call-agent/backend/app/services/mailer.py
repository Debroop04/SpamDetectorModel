"""SMTP email sender (works with a free Gmail account and an app password)."""

import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr, make_msgid

import certifi

from app.config import settings


class MailNotConfigured(RuntimeError):
    pass


def send_email(
    to: list[str],
    subject: str,
    text: str,
    html: str,
    cc: list[str] | None = None,
    reply_to: str | None = None,
    attachments: list[tuple[str, bytes, str]] | None = None,
) -> str:
    """Send an email and return its Message-ID. Attachments are (filename, data, mime_type)."""
    if not settings.smtp_configured:
        raise MailNotConfigured("Email is not configured. Set SMTP_USERNAME and SMTP_PASSWORD in backend/.env.")

    message = EmailMessage()
    message["From"] = formataddr((settings.SMTP_FROM_NAME, settings.SMTP_USERNAME))
    message["To"] = ", ".join(to)
    if cc:
        message["Cc"] = ", ".join(cc)
    if reply_to:
        message["Reply-To"] = reply_to
    message["Subject"] = subject
    message_id = make_msgid(domain="callshield.local")
    message["Message-ID"] = message_id
    message.set_content(text)
    message.add_alternative(html, subtype="html")
    for filename, data, mime_type in attachments or []:
        maintype, subtype = mime_type.split("/", 1)
        message.add_attachment(data, maintype=maintype, subtype=subtype, filename=filename)

    # certifi's CA bundle works even where the system Python has no certificates installed (common on macOS).
    context = ssl.create_default_context(cafile=certifi.where())
    if settings.SMTP_PORT == 465:
        with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, context=context, timeout=30) as server:
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(message)
    else:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30) as server:
            server.starttls(context=context)
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(message)
    return message_id
