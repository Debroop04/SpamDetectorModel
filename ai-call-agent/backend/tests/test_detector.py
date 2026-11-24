import pytest

from app.models import SpamNumber
from app.phone import normalize_number
from app.services import detector


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("+91 98765 43210", "+919876543210"),
        ("9876543210", "+919876543210"),
        ("09876543210", "+919876543210"),
        ("91 9999999999", "+919999999999"),
        ("+1 (415) 555-0100", "+14155550100"),
        ("client:user-1", ""),
        ("", ""),
    ],
)
def test_normalize_number(raw, expected):
    assert normalize_number(raw) == expected


@pytest.mark.parametrize(
    "text",
    [
        "Hello, I am calling from your bank. Your KYC has expired and your account will be blocked. Please share the OTP.",
        "Congratulations, you have won a lottery. Pay a small processing fee to claim the prize.",
        "This is a CBI officer. A parcel in your name has drugs. You are under digital arrest.",
        "Please install AnyDesk so I can process your refund.",
        "Sir aapka bijli connection aaj raat cut ho jayega, turant payment kijiye",
        "आपका खाता बंद हो जाएगा, कृपया ओटीपी बताइए",
    ],
)
def test_scam_calls_are_spam(db, text):
    result = detector.evaluate(db, "+919000011111", [text], [text])
    assert result.verdict == "spam", (result.score, result.reasons)
    assert result.category
    assert result.reasons


@pytest.mark.parametrize(
    "text",
    [
        "Hi, this is Rahul from college, calling about tomorrow's project meeting.",
        "Hello, my name is Priya from the dental clinic, calling to confirm your appointment.",
        "Hi it's mom, call me back when you are free.",
    ],
)
def test_normal_calls_are_safe(db, text):
    result = detector.evaluate(db, "+919000011111", [text], [text])
    assert result.verdict == "safe", (result.score, result.reasons)
    assert result.category is None


def test_reputation_raises_score(db):
    db.add(SpamNumber(number="+919812345678", category="Financial scam", reports=25, source="seed"))
    db.commit()
    text = "Hello, this is your friend Aman."
    clean = detector.evaluate(db, "+919000011111", [text], [text])
    reported = detector.evaluate(db, "+919812345678", [text], [text])
    assert clean.verdict == "safe"
    assert reported.verdict == "spam"
    assert reported.reputation_reports == 25


def test_seed_reads_model_csv_without_changing_it(db):
    from pathlib import Path

    from app.config import settings

    path = Path(settings.MODEL_DIR) / "spam_numbers.csv"
    before = path.read_bytes()
    count = detector.seed_spam_numbers(db)
    assert count > 0
    assert detector.seed_spam_numbers(db) == 0
    assert path.read_bytes() == before
    assert db.get(SpamNumber, "+919876543210").reports >= 25


def test_urgency_alone_is_not_spam(db):
    text = "Please call me back urgently, it is about the family function."
    result = detector.evaluate(db, "+919000011111", [text], [text])
    assert result.verdict != "spam"
