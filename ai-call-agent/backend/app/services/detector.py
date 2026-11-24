"""Spam and scam detection.

Combines three signals:
- the ML team's TF-IDF + Logistic Regression model (loaded read-only from MODEL_DIR),
- weighted scam phrase rules in English, Hinglish and Hindi,
- the caller number's community reputation.
"""

import csv
import logging
import re
import threading
from dataclasses import asdict, dataclass, field
from pathlib import Path

from sqlalchemy.orm import Session

from app.config import settings
from app.database import utcnow
from app.models import SpamNumber
from app.formatting import percent
from app.phone import normalize_number

logger = logging.getLogger("callshield.detector")


@dataclass(frozen=True)
class Rule:
    key: str
    category: str
    weight: float
    reason: str
    patterns: tuple[str, ...]


RULES: tuple[Rule, ...] = (
    Rule(
        "otp",
        "OTP or PIN theft",
        0.7,
        "The caller asks for an OTP, PIN or verification code.",
        (
            r"\botp\b",
            r"one[- ]time password",
            r"verification code",
            r"\b(upi|atm|card) pin\b",
            r"\bcvv\b",
            r"(code|pin)\s*(batao|bataiye|bata do|bhejo|share kar)",
            r"ओटीपी",
            r"(कोड|पिन)\s*(बताइए|बताओ|बता दो|भेज)",
        ),
    ),
    Rule(
        "bank_kyc",
        "Bank or KYC fraud",
        0.75,
        "The caller claims a bank account, card or KYC problem.",
        (
            r"\bkyc\b",
            r"account (will be |has been |is |got )?(blocked|suspended|frozen|closed|deactivated)",
            r"card (will be |has been |is )?(blocked|suspended|deactivated)",
            r"update your (kyc|pan|aadhaar)",
            r"(khata|account)\s*(band|block)",
            r"केवाईसी",
            r"खाता\s*(बंद|ब्लॉक)",
        ),
    ),
    Rule(
        "fake_authority",
        "Fake police or legal threat",
        0.85,
        "The caller impersonates police, CBI, customs or a court to threaten the receiver.",
        (
            r"digital arrest",
            r"arrest warrant",
            r"\bcbi\b",
            r"money laundering",
            r"(customs|narcotics).{0,40}(parcel|package|drugs)",
            r"(parcel|package).{0,40}(drugs|illegal|seized)",
            r"(fir|case) (has been |is )?(registered|filed) against you",
            r"court (notice|summons)",
            r"giraftar|गिरफ्तार|डिजिटल अरेस्ट",
        ),
    ),
    Rule(
        "prize",
        "Lottery or prize scam",
        0.8,
        "The caller offers a lottery, prize or lucky draw win.",
        (
            r"lottery",
            r"jackpot",
            r"you (have )?won",
            r"won (a|the) (prize|car|reward)",
            r"lucky draw",
            r"\bkbc\b",
            r"(cash|prize) money",
            r"inaam|इनाम|लॉटरी",
        ),
    ),
    Rule(
        "fee",
        "Payment or fee demand",
        0.6,
        "The caller demands a fee, payment or money transfer.",
        (
            r"processing fee",
            r"registration fee",
            r"pay (a |the )?(small )?(fee|amount|charge|penalty)",
            r"(transfer|send) (the )?money",
            r"gift card",
            r"paise (bhejo|transfer)",
            r"fees? (bharo|jama)",
            r"पैसे\s*(भेज|ट्रांसफर)",
        ),
    ),
    Rule(
        "remote_access",
        "Remote access request",
        0.8,
        "The caller asks to install a screen sharing or remote access app.",
        (
            r"anydesk|any desk",
            r"teamviewer|team viewer",
            r"quick ?support",
            r"screen shar(e|ing)",
            r"(install|download) (this|an|the) app",
        ),
    ),
    Rule(
        "utility",
        "Utility disconnection threat",
        0.8,
        "The caller threatens to cut electricity, gas or SIM service.",
        (
            r"(electricity|power|bijli|gas|sim|connection).{0,40}(disconnect|cut|suspend|deactivat|band)",
            r"बिजली.{0,20}(कट|बंद)",
        ),
    ),
    Rule(
        "sensitive",
        "Sensitive details request",
        0.65,
        "The caller asks for passwords, card numbers or identity documents.",
        (
            r"\bpassword\b",
            r"net ?banking",
            r"card number",
            r"expiry date",
            r"(aadhaar|aadhar|pan) (card )?number",
            r"bank details",
        ),
    ),
    Rule(
        "investment",
        "Investment or job scam",
        0.7,
        "The caller pitches easy money, guaranteed returns or task jobs.",
        (
            r"work from home",
            r"part[- ]time job",
            r"daily (income|earning)",
            r"guaranteed (return|profit)",
            r"double your money",
            r"crypto(currency)? (investment|trading)",
            r"task (based )?job",
            r"(like|watch) (youtube )?videos and earn",
        ),
    ),
    Rule(
        "urgency",
        "Pressure tactics",
        0.3,
        "The caller uses urgency to pressure the receiver.",
        (
            r"\burgent(ly)?\b",
            r"\bimmediately\b",
            r"within (24 hours|today|\d+ (minutes|hours))",
            r"last chance",
            r"turant|abhi ke abhi|तुरंत",
        ),
    ),
)

_COMPILED = [(rule, [re.compile(p, re.IGNORECASE) for p in rule.patterns]) for rule in RULES]


@dataclass
class Detection:
    score: float
    verdict: str  # safe | suspicious | spam
    category: str | None
    reasons: list[str] = field(default_factory=list)
    model_score: float | None = None
    rule_score: float = 0.0
    reputation_score: float = 0.0
    reputation_reports: int = 0
    matched_rules: list[str] = field(default_factory=list)

    def signals(self) -> dict:
        data = asdict(self)
        return {k: data[k] for k in ("model_score", "rule_score", "reputation_score", "reputation_reports", "matched_rules")}


class SpamModel:
    """Lazy, thread-safe loader for the ML team's pickled model."""

    def __init__(self, model_dir: str) -> None:
        self.model_dir = Path(model_dir)
        self._lock = threading.Lock()
        self._model = None
        self._vectorizer = None
        self.error: str | None = None

    @property
    def loaded(self) -> bool:
        return self._model is not None

    def load(self) -> bool:
        with self._lock:
            if self._model is not None:
                return True
            try:
                import joblib

                self._model = joblib.load(self.model_dir / "spam_model.pkl")
                self._vectorizer = joblib.load(self.model_dir / "tfidf_vectorizer.pkl")
                self.error = None
                logger.info("Spam model loaded from %s", self.model_dir)
            except Exception as exc:  # missing files or incompatible pickle
                self.error = str(exc)
                logger.error("Could not load spam model: %s", exc)
        return self._model is not None

    def spam_probability(self, text: str) -> float | None:
        if not text.strip() or not self.load():
            return None
        vector = self._vectorizer.transform([text])
        probabilities = self._model.predict_proba(vector)[0]
        classes = list(self._model.classes_)
        index = classes.index(1) if 1 in classes else len(classes) - 1
        return float(probabilities[index])


spam_model = SpamModel(settings.MODEL_DIR)


def match_rules(texts: list[str]) -> tuple[float, list[Rule]]:
    """Return a combined rule score (noisy-OR of matched weights) and the matched rules."""
    joined = " \n ".join(t for t in texts if t)
    matched = [rule for rule, patterns in _COMPILED if any(p.search(joined) for p in patterns)]
    remaining = 1.0
    for rule in matched:
        remaining *= 1.0 - rule.weight
    score = 1.0 - remaining if matched else 0.0
    # Urgency alone is not enough to call something a scam.
    if [r.key for r in matched] == ["urgency"]:
        score = min(score, 0.3)
    return min(score, 0.99), matched


def reputation_score(reports: int) -> float:
    if reports <= 0:
        return 0.0
    return min(0.95, 0.5 + 0.05 * reports)


def get_reputation(db: Session, number: str) -> SpamNumber | None:
    normalized = normalize_number(number)
    if not normalized:
        return None
    return db.get(SpamNumber, normalized)


def evaluate(
    db: Session,
    caller_number: str,
    texts: list[str],
    texts_en: list[str],
    block_threshold: float | None = None,
) -> Detection:
    """Score a call from all caller utterances so far.

    texts: what the caller said (original language) for phrase rules.
    texts_en: English versions for the ML model.
    """
    block_threshold = block_threshold or settings.DEFAULT_BLOCK_THRESHOLD
    reasons: list[str] = []

    rule_score, matched = match_rules(texts + texts_en)
    english = " ".join(t for t in texts_en if t).strip()
    model_score = spam_model.spam_probability(english) if english else None

    reputation = get_reputation(db, caller_number)
    reports = reputation.reports if reputation else 0
    rep_score = reputation_score(reports)

    text_score = max(model_score or 0.0, rule_score)
    score = 1.0 - (1.0 - text_score) * (1.0 - rep_score * 0.85)
    score = round(min(score, 0.99), 3)

    category: str | None = None
    if matched:
        strongest = max(matched, key=lambda r: r.weight)
        category = strongest.category
        reasons.extend(r.reason for r in sorted(matched, key=lambda r: -r.weight))
    if model_score is not None and model_score >= settings.SUSPICIOUS_THRESHOLD:
        reasons.append(f"The spam model rates this conversation {percent(model_score)} likely to be a scam.")
        category = category or "Suspected scam call"
    if reports:
        reasons.append(f"This number has {reports} spam report{'s' if reports != 1 else ''} ({reputation.category}).")
        category = category or reputation.category

    if score >= block_threshold:
        verdict = "spam"
    elif score >= settings.SUSPICIOUS_THRESHOLD:
        verdict = "suspicious"
    else:
        verdict = "safe"
        if not reasons:
            reasons.append("No scam patterns were found in the conversation.")

    return Detection(
        score=score,
        verdict=verdict,
        category=category if verdict != "safe" else None,
        reasons=reasons,
        model_score=round(model_score, 3) if model_score is not None else None,
        rule_score=round(rule_score, 3),
        reputation_score=round(rep_score, 3),
        reputation_reports=reports,
        matched_rules=[r.key for r in matched],
    )


def add_community_report(db: Session, number: str, category: str, source: str = "community") -> SpamNumber | None:
    normalized = normalize_number(number)
    if not normalized:
        return None
    row = db.get(SpamNumber, normalized)
    if row is None:
        row = SpamNumber(number=normalized, category=category, reports=0, source=source)
        db.add(row)
    row.reports += 1
    row.last_reported_at = utcnow()
    if category and row.source != "seed":
        row.category = category
    db.commit()
    return row


def seed_spam_numbers(db: Session) -> int:
    """Copy the ML team's spam_numbers.csv into the database once. The CSV is never modified."""
    if db.query(SpamNumber).first() is not None:
        return 0
    path = Path(settings.MODEL_DIR) / "spam_numbers.csv"
    if not path.exists():
        return 0
    merged: dict[str, SpamNumber] = {}
    with path.open(encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            number = normalize_number(row.get("phone_number"))
            if not number:
                continue
            try:
                reports = max(1, int(row.get("reports") or 1))
            except ValueError:
                reports = 1
            category = (row.get("category") or "Reported spam").replace("_", " ").strip().capitalize()
            if number in merged:
                merged[number].reports += reports
            else:
                merged[number] = SpamNumber(number=number, category=category, reports=reports, source="seed")
    db.add_all(merged.values())
    db.commit()
    return len(merged)
