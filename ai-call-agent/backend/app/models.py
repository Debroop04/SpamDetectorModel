"""SQLAlchemy ORM models."""

from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, utcnow


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(16), default="user", server_default="user")  # user | admin

    # Real phone that safe calls are forwarded to (must be verified in Twilio on a trial account).
    phone: Mapped[Optional[str]] = mapped_column(String(32))
    # Twilio number that protects this user.
    line_number: Mapped[Optional[str]] = mapped_column(String(32), unique=True, index=True)

    lat: Mapped[Optional[float]] = mapped_column(Float)
    lng: Mapped[Optional[float]] = mapped_column(Float)
    address: Mapped[Optional[str]] = mapped_column(String(500))
    station_id: Mapped[Optional[int]] = mapped_column(ForeignKey("police_stations.id", ondelete="SET NULL"))

    language: Mapped[str] = mapped_column(String(8), default="ask")  # ask | en | hi
    block_threshold: Mapped[float] = mapped_column(Float, default=0.75)
    auto_report: Mapped[bool] = mapped_column(Boolean, default=True)
    police_delivery: Mapped[str] = mapped_column(String(8), default="test")  # test | live

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    station: Mapped[Optional["PoliceStation"]] = relationship(foreign_keys=[station_id])


class PoliceStation(Base):
    __tablename__ = "police_stations"

    id: Mapped[int] = mapped_column(primary_key=True)
    osm_id: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    address: Mapped[Optional[str]] = mapped_column(String(500))
    phone: Mapped[Optional[str]] = mapped_column(String(64))
    email: Mapped[Optional[str]] = mapped_column(String(255))
    email_source: Mapped[Optional[str]] = mapped_column(String(16))  # osm | user
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class Call(Base):
    __tablename__ = "calls"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    twilio_sid: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    channel: Mapped[str] = mapped_column(String(16), default="phone")  # phone | browser
    caller_number: Mapped[str] = mapped_column(String(32), index=True)
    caller_name: Mapped[Optional[str]] = mapped_column(String(120))

    # screening | forwarding | connected | voicemail | blocked | missed | ended
    status: Mapped[str] = mapped_column(String(16), default="screening", index=True)
    language: Mapped[str] = mapped_column(String(8), default="en")
    verdict: Mapped[str] = mapped_column(String(16), default="pending", index=True)  # pending | safe | suspicious | spam
    risk_score: Mapped[float] = mapped_column(Float, default=0.0)
    category: Mapped[Optional[str]] = mapped_column(String(80))
    reasons: Mapped[list] = mapped_column(JSON, default=list)
    signals: Mapped[dict] = mapped_column(JSON, default=dict)
    turns_count: Mapped[int] = mapped_column(Integer, default=0)

    recording_sid: Mapped[Optional[str]] = mapped_column(String(64))
    recording_duration: Mapped[Optional[int]] = mapped_column(Integer)
    duration: Mapped[Optional[int]] = mapped_column(Integer)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    turns: Mapped[list["CallTurn"]] = relationship(
        back_populates="call", cascade="all, delete-orphan", order_by="CallTurn.id"
    )


class CallTurn(Base):
    __tablename__ = "call_turns"

    id: Mapped[int] = mapped_column(primary_key=True)
    call_id: Mapped[int] = mapped_column(ForeignKey("calls.id", ondelete="CASCADE"), index=True)
    speaker: Mapped[str] = mapped_column(String(16))  # assistant | caller
    text: Mapped[str] = mapped_column(Text)
    text_en: Mapped[Optional[str]] = mapped_column(Text)
    confidence: Mapped[Optional[float]] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    call: Mapped[Call] = relationship(back_populates="turns")


class SpamNumber(Base):
    """Community reputation for a phone number."""

    __tablename__ = "spam_numbers"

    number: Mapped[str] = mapped_column(String(32), primary_key=True)
    category: Mapped[str] = mapped_column(String(80), default="Reported spam")
    reports: Mapped[int] = mapped_column(Integer, default=0)
    source: Mapped[str] = mapped_column(String(16), default="community")  # seed | community | auto
    last_reported_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class NumberReport(Base):
    """One user's report about a number. Location is rounded to about 1 km."""

    __tablename__ = "number_reports"
    __table_args__ = (UniqueConstraint("number", "user_id", name="uq_number_report_user"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    number: Mapped[str] = mapped_column(String(32), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    call_id: Mapped[Optional[int]] = mapped_column(ForeignKey("calls.id", ondelete="SET NULL"))
    category: Mapped[str] = mapped_column(String(80))
    note: Mapped[Optional[str]] = mapped_column(Text)
    approx_lat: Mapped[Optional[float]] = mapped_column(Float)
    approx_lng: Mapped[Optional[float]] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class NumberRule(Base):
    """Personal allow or block rule for a number."""

    __tablename__ = "number_rules"
    __table_args__ = (UniqueConstraint("user_id", "number", name="uq_number_rule_user"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    number: Mapped[str] = mapped_column(String(32))
    kind: Mapped[str] = mapped_column(String(8))  # allow | block
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Report(Base):
    """Police complaint created for a fraudulent call."""

    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    call_id: Mapped[Optional[int]] = mapped_column(ForeignKey("calls.id", ondelete="SET NULL"), index=True)
    source: Mapped[str] = mapped_column(String(16))  # auto | user | manual
    caller_number: Mapped[str] = mapped_column(String(32), index=True)
    category: Mapped[str] = mapped_column(String(80))
    summary: Mapped[str] = mapped_column(Text)
    risk_score: Mapped[Optional[float]] = mapped_column(Float)

    # Complainant location at the time of the report
    lat: Mapped[Optional[float]] = mapped_column(Float)
    lng: Mapped[Optional[float]] = mapped_column(Float)
    address: Mapped[Optional[str]] = mapped_column(String(500))

    # Police station snapshot
    station_name: Mapped[Optional[str]] = mapped_column(String(255))
    station_lat: Mapped[Optional[float]] = mapped_column(Float)
    station_lng: Mapped[Optional[float]] = mapped_column(Float)
    station_phone: Mapped[Optional[str]] = mapped_column(String(64))
    station_email: Mapped[Optional[str]] = mapped_column(String(255))
    station_address: Mapped[Optional[str]] = mapped_column(String(500))
    distance_km: Mapped[Optional[float]] = mapped_column(Float)

    # queued | sent | needs_email | failed | acknowledged
    status: Mapped[str] = mapped_column(String(16), default="queued", index=True)
    mode: Mapped[str] = mapped_column(String(8), default="test")  # test | live
    sent_to: Mapped[Optional[str]] = mapped_column(String(255))
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    error: Mapped[Optional[str]] = mapped_column(Text)

    ack_token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    ack_by: Mapped[Optional[str]] = mapped_column(String(120))
    ack_note: Mapped[Optional[str]] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)

    user: Mapped[User] = relationship()
    call: Mapped[Optional[Call]] = relationship()

    @property
    def reference(self) -> str:
        return f"CS-{self.created_at:%Y}-{self.id:05d}"


class AppState(Base):
    """Small key/value store for runtime values such as provisioned Twilio IDs."""

    __tablename__ = "app_state"

    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
