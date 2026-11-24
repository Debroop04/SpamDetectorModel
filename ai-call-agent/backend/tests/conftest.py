import os
import tempfile
from urllib.parse import urlencode

import pytest

_db_dir = tempfile.mkdtemp(prefix="callshield-test-")
os.environ.update(
    {
        "DATABASE_URL": f"sqlite:///{_db_dir}/test.db",
        "SECRET_KEY": "test-secret-key-that-is-long-enough-123456",
        "TWILIO_ACCOUNT_SID": "AC" + "0" * 32,
        "TWILIO_AUTH_TOKEN": "test-auth-token",
        "TWILIO_PHONE_NUMBER": "+15005550006",
        "PUBLIC_BASE_URL": "https://shield.example.com",
        "SMTP_USERNAME": "sender@example.com",
        "SMTP_PASSWORD": "app-password",
        "FALLBACK_POLICE_EMAIL": "",
        "ALLOW_LIVE_POLICE_EMAIL": "false",
        "TRANSLATOR": "off",
        "DISCOVERY_ENABLED": "false",
    }
)

from fastapi.testclient import TestClient  # noqa: E402
from twilio.request_validator import RequestValidator  # noqa: E402

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.services import geo, reporting, twilio_service  # noqa: E402

OVERPASS_FIXTURE = {
    "elements": [
        {
            "type": "node",
            "id": 101,
            "lat": 28.6300,
            "lon": 77.2200,
            "tags": {"amenity": "police", "name": "Connaught Place Police Station", "phone": "+91 11 2336 1231"},
        },
        {
            "type": "way",
            "id": 202,
            "center": {"lat": 28.6200, "lon": 77.2100},
            "tags": {"amenity": "police", "name": "Police Booth", "email": "booth@police.example"},
        },
    ]
}


@pytest.fixture(autouse=True)
def fresh_db(monkeypatch):
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    monkeypatch.setattr(geo, "_overpass_query", lambda lat, lng, radius: OVERPASS_FIXTURE)
    monkeypatch.setattr(geo, "reverse_geocode", lambda lat, lng: "Connaught Place, New Delhi, Delhi 110001, India")
    monkeypatch.setattr(twilio_service, "sync", lambda db: {"ok": False, "error": "disabled in tests"})
    yield


@pytest.fixture
def outbox(monkeypatch):
    sent = []

    def fake_send(**kwargs):
        sent.append(kwargs)
        return "<test@callshield>"

    monkeypatch.setattr(reporting, "send_email", lambda **kw: fake_send(**kw))
    return sent


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.close()


def register(client, email="asha@example.com", name="Asha Verma"):
    response = client.post("/api/auth/register", json={"name": name, "email": email, "password": "strong-pass-1"})
    assert response.status_code == 201, response.text
    data = response.json()
    return data["token"], data["user"]


@pytest.fixture
def account(client):
    token, user = register(client)
    headers = {"Authorization": f"Bearer {token}"}
    assert client.patch("/api/me", json={"phone": "98111 22333"}, headers=headers).status_code == 200
    assert client.put("/api/me/location", json={"lat": 28.6315, "lng": 77.2167}, headers=headers).status_code == 200
    assert client.post("/api/me/line", headers=headers).status_code == 200
    return {"token": token, "user": user, "headers": headers}


class Twilio:
    """Sends correctly signed webhook requests, like Twilio does."""

    def __init__(self, client):
        self.client = client
        self.validator = RequestValidator("test-auth-token")

    def post(self, path: str, params: dict | None = None, form: dict | None = None, sign: bool = True):
        url = f"https://shield.example.com{path}" + (f"?{urlencode(params)}" if params else "")
        form = form or {}
        headers = {"X-Twilio-Signature": self.validator.compute_signature(url, form) if sign else "bad"}
        return self.client.post(path, params=params, data=form, headers=headers)


@pytest.fixture
def twilio(client):
    return Twilio(client)
