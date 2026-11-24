"""Display helpers shared by emails, PDFs and the police page (kept in step with the frontend)."""

import math


def percent(value: float | None) -> str:
    """Round half up, like JavaScript's Math.round, so every screen shows the same number."""
    return f"{math.floor((value or 0) * 100 + 0.5)}%"


def display_number(number: str | None) -> str:
    if not number:
        return "Unknown"
    if number.startswith("+91") and len(number) == 13:
        return f"+91 {number[3:8]} {number[8:]}"
    if number.startswith("+1") and len(number) == 12:
        return f"+1 {number[2:5]} {number[5:8]} {number[8:]}"
    return number
