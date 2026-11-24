"""Phone number normalization."""

import re

from app.config import settings

_DIGITS = re.compile(r"\D")


def normalize_number(raw: str | None, default_cc: str | None = None) -> str:
    """Return an E.164-like number ("+919876543210") or "" when the input has no usable digits.

    Ten-digit numbers and numbers with a leading trunk zero get the default country code.
    """
    if not raw:
        return ""
    raw = raw.strip()
    cc = default_cc or settings.DEFAULT_COUNTRY_CODE
    digits = _DIGITS.sub("", raw)
    if len(digits) < 6:
        return ""
    if raw.startswith("+") or raw.startswith("00"):
        return "+" + digits.lstrip("0") if raw.startswith("00") else "+" + digits
    if len(digits) == 11 and digits.startswith("0"):
        return f"+{cc}{digits[1:]}"
    if len(digits) == 10:
        return f"+{cc}{digits}"
    return "+" + digits


def mask_number(number: str) -> str:
    if len(number) <= 6:
        return number
    return number[:-6] + "••" + number[-4:]
