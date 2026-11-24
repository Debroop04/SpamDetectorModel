"""Request and response models."""

from datetime import datetime, timezone
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, PlainSerializer, field_validator


def _utc(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat().replace("+00:00", "Z")


UTCDateTime = Annotated[datetime, PlainSerializer(_utc, return_type=Optional[str])]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Auth and profile ----------


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class StationOut(ORM):
    id: int
    name: str
    lat: float
    lng: float
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    email_source: Optional[str] = None
    distance_km: Optional[float] = None


class UserOut(ORM):
    id: int
    name: str
    email: str
    role: str = "user"
    phone: Optional[str] = None
    line_number: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    address: Optional[str] = None
    language: str
    block_threshold: float
    auto_report: bool
    police_delivery: str
    station: Optional[StationOut] = None
    created_at: UTCDateTime


class SessionOut(BaseModel):
    token: str
    user: UserOut


class UserUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    phone: Optional[str] = None
    language: Optional[Literal["ask", "en", "hi"]] = None
    block_threshold: Optional[float] = Field(default=None, ge=0.5, le=0.95)
    auto_report: Optional[bool] = None
    police_delivery: Optional[Literal["test", "live"]] = None


class LocationIn(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class LocationOut(BaseModel):
    user: UserOut
    stations: list[StationOut]


class StationSelectIn(BaseModel):
    station_id: int
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=64)

    @field_validator("email", mode="before")
    @classmethod
    def blank_email(cls, value):
        return value or None


# ---------- Calls ----------


class TurnOut(ORM):
    id: int
    speaker: str
    text: str
    text_en: Optional[str] = None
    confidence: Optional[float] = None
    created_at: UTCDateTime


class CallOut(ORM):
    id: int
    channel: str
    caller_number: str
    caller_name: Optional[str] = None
    status: str
    language: str
    verdict: str
    risk_score: float
    category: Optional[str] = None
    reasons: list[str] = []
    turns_count: int
    started_at: UTCDateTime
    ended_at: Optional[UTCDateTime] = None
    duration: Optional[int] = None
    has_recording: bool = False


class ReportBrief(ORM):
    id: int
    reference: str
    status: str
    mode: str
    station_name: Optional[str] = None
    sent_to: Optional[str] = None
    acknowledged_at: Optional[UTCDateTime] = None
    created_at: UTCDateTime


class CallDetail(CallOut):
    signals: dict = {}
    turns: list[TurnOut] = []
    report: Optional[ReportBrief] = None
    rule: Optional[str] = None
    number_reports: int = 0


class CallPage(BaseModel):
    items: list[CallOut]
    total: int


# ---------- Reports ----------


class ReportOut(ORM):
    id: int
    reference: str
    source: str
    call_id: Optional[int] = None
    caller_number: str
    category: str
    summary: str
    risk_score: Optional[float] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    address: Optional[str] = None
    station_name: Optional[str] = None
    station_lat: Optional[float] = None
    station_lng: Optional[float] = None
    station_phone: Optional[str] = None
    station_email: Optional[str] = None
    station_address: Optional[str] = None
    distance_km: Optional[float] = None
    status: str
    mode: str
    sent_to: Optional[str] = None
    sent_at: Optional[UTCDateTime] = None
    error: Optional[str] = None
    acknowledged_at: Optional[UTCDateTime] = None
    ack_by: Optional[str] = None
    ack_note: Optional[str] = None
    created_at: UTCDateTime
    public_url: Optional[str] = None


class ManualReportIn(BaseModel):
    number: str = Field(min_length=6, max_length=32)
    category: str = Field(min_length=2, max_length=80)
    note: Optional[str] = Field(default=None, max_length=2000)
    send_to_police: bool = True


class ManualReportOut(BaseModel):
    number: str
    counted: bool
    report: Optional[ReportOut] = None
    duplicate_report: bool = False


# ---------- Numbers ----------


class NumberLookupOut(BaseModel):
    number: str
    reports: int
    category: Optional[str] = None
    risk: float
    level: Literal["unknown", "reported", "dangerous"]
    last_reported_at: Optional[UTCDateTime] = None
    rule: Optional[str] = None


class SpamNumberOut(ORM):
    number: str
    category: str
    reports: int
    source: str
    last_reported_at: UTCDateTime


class RuleIn(BaseModel):
    number: str = Field(min_length=6, max_length=32)
    kind: Literal["allow", "block"]


class RuleOut(ORM):
    id: int
    number: str
    kind: str
    created_at: UTCDateTime


class HotspotOut(BaseModel):
    lat: float
    lng: float
    count: int
    category: str


# ---------- Stats and system ----------


class DayCount(BaseModel):
    date: str
    total: int
    spam: int


class StatsOut(BaseModel):
    screened: int
    blocked: int
    safe: int
    connected: int
    suspicious: int
    reports_sent: int
    reports_acknowledged: int
    last_7_days: list[DayCount]
    top_categories: list[dict]


class AdminUserRow(BaseModel):
    id: int
    name: str
    email: str
    role: str
    phone: Optional[str] = None
    address: Optional[str] = None
    calls: int
    scams: int
    reports: int
    created_at: UTCDateTime


class AdminRoleIn(BaseModel):
    role: Literal["user", "admin"]


class AdminOverview(BaseModel):
    users: int
    admins: int
    calls: int
    scams_blocked: int
    reports_sent: int
    reports_acknowledged: int
    reported_numbers: int
    last_7_days: list[DayCount]


class AdminReportRow(ReportOut):
    user_name: str
    user_email: str


class SystemStatus(BaseModel):
    public_url: Optional[str]
    public_url_source: Optional[str]
    twilio_configured: bool
    twilio_number: Optional[str]
    twilio_sync: Optional[dict]
    smtp_configured: bool
    smtp_sender: Optional[str]
    live_delivery_allowed: bool
    fallback_police_email: bool
    model_loaded: bool
    model_error: Optional[str]
    translator: str
    line_owner_is_you: bool
    line_claimed: bool
