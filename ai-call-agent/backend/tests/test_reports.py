from app.config import settings
from app.models import PoliceStation, Report
from app.services import geo
from tests.conftest import OVERPASS_FIXTURE, register


def test_auth_flow(client):
    token, user = register(client, email="ravi@example.com", name="Ravi Kumar")
    assert user["police_delivery"] == "test"
    assert client.post("/api/auth/register", json={"name": "Ravi", "email": "ravi@example.com", "password": "another-pass"}).status_code == 409
    assert client.post("/api/auth/login", json={"email": "ravi@example.com", "password": "wrong-pass"}).status_code == 401
    login = client.post("/api/auth/login", json={"email": "RAVI@example.com", "password": "strong-pass-1"})
    assert login.status_code == 200
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {login.json()['token']}"}).json()["name"] == "Ravi Kumar"
    assert client.get("/api/auth/me").status_code == 401


def test_overpass_parsing_and_station_choice():
    stations = geo.parse_overpass(OVERPASS_FIXTURE)
    assert [s["osm_id"] for s in stations] == ["node/101", "way/202"]
    assert stations[1]["lat"] == 28.62
    assert stations[1]["email"] == "booth@police.example"


def test_station_lookup_falls_back_when_overpass_is_down(db, monkeypatch):
    def overpass_down(lat, lng, radius):
        raise RuntimeError("Police station lookup failed (all mirrors timed out)")

    monkeypatch.setattr(geo, "_overpass_query", overpass_down)
    monkeypatch.setattr(
        geo,
        "_nominatim_search",
        lambda lat, lng, radius: [
            {"osm_id": "node/7", "name": "Mandir Marg Police Station", "lat": 28.6388, "lng": 77.2027, "address": None, "phone": "+91 11 2336 1231", "email": None}
        ],
    )
    monkeypatch.setattr(
        geo,
        "_photon_search",
        lambda lat, lng: [
            {"osm_id": "node/7", "name": "Mandir Marg Police Station", "lat": 28.6388, "lng": 77.2027, "address": "Mandir Marg, New Delhi", "phone": None, "email": None},
            {"osm_id": "node/8", "name": "Far Away Police", "lat": 28.5289, "lng": 77.3846, "address": None, "phone": None, "email": None},
        ],
    )
    found = geo.nearby_stations(db, 28.6315, 77.2167)
    assert [f.station.name for f in found] == ["Mandir Marg Police Station"]
    assert found[0].station.phone == "+91 11 2336 1231"
    assert found[0].station.address == "Mandir Marg, New Delhi"


def test_location_picks_real_station_over_booth(account, client):
    me = client.get("/api/auth/me", headers=account["headers"]).json()
    assert me["station"]["name"] == "Connaught Place Police Station"
    assert me["address"].startswith("Connaught Place")


def test_manual_report_and_dedupe(account, client, db, outbox):
    body = {"number": "98000 12345", "category": "Bank or KYC fraud", "note": "Asked for my OTP", "send_to_police": True}
    first = client.post("/api/numbers/report", json=body, headers=account["headers"]).json()
    assert first["counted"] is True
    assert first["report"]["caller_number"] == "+919800012345"
    second = client.post("/api/numbers/report", json=body, headers=account["headers"]).json()
    assert second["counted"] is False
    assert second["duplicate_report"] is True
    assert db.query(Report).count() == 1
    assert len(outbox) == 1

    lookup = client.get("/api/numbers/lookup", params={"number": "+919800012345"}, headers=account["headers"]).json()
    assert lookup["reports"] == 1
    assert lookup["level"] == "reported"

    hotspots = client.get("/api/numbers/hotspots", params={"lat": 28.63, "lng": 77.22}, headers=account["headers"]).json()
    assert hotspots[0]["count"] == 1


def test_live_mode_is_locked_without_server_flag(account, client):
    response = client.patch("/api/me", json={"police_delivery": "live"}, headers=account["headers"])
    assert response.status_code == 403


def test_live_mode_needs_station_email(account, client, db, outbox, monkeypatch):
    monkeypatch.setattr(settings, "ALLOW_LIVE_POLICE_EMAIL", True)
    assert client.patch("/api/me", json={"police_delivery": "live"}, headers=account["headers"]).status_code == 200
    body = {"number": "98000 99999", "category": "Lottery or prize scam", "send_to_police": True}
    client.post("/api/numbers/report", json=body, headers=account["headers"])
    db.expire_all()
    report = db.query(Report).one()
    assert report.mode == "live"
    assert report.status == "needs_email"
    assert outbox == []

    station = db.query(PoliceStation).filter_by(osm_id="node/101").one()
    client.put("/api/me/station", json={"station_id": station.id, "email": "sho-cp@police.example"}, headers=account["headers"])
    resent = client.post(f"/api/reports/{report.id}/resend", headers=account["headers"])
    assert resent.status_code == 200
    db.expire_all()
    report = db.query(Report).one()
    assert report.status == "sent"
    assert outbox[0]["to"] == ["sho-cp@police.example"]
    assert outbox[0]["cc"] == ["asha@example.com"]
    assert not outbox[0]["subject"].startswith("[TEST]")


def test_police_can_view_and_acknowledge_without_login(account, client, db, outbox):
    client.post("/api/numbers/report", json={"number": "98000 55555", "category": "Fake police or legal threat", "send_to_police": True}, headers=account["headers"])
    report = db.query(Report).one()

    page = client.get(f"/r/{report.ack_token}")
    assert page.status_code == 200
    assert "Acknowledge receipt" in page.text
    assert "+91 98000 55555" in page.text
    assert "gradient" not in page.text.lower()

    pdf = client.get(f"/r/{report.ack_token}/pdf")
    assert pdf.content.startswith(b"%PDF")

    ack = client.post(f"/r/{report.ack_token}/ack", data={"officer": "SI R. Sharma", "note": "Case registered"}, follow_redirects=False)
    assert ack.status_code == 303
    db.expire_all()
    report = db.query(Report).one()
    assert report.status == "acknowledged"
    assert report.ack_by == "SI R. Sharma"
    assert "Receipt acknowledged" in client.get(f"/r/{report.ack_token}").text

    assert client.get("/r/not-a-real-token").status_code == 404


def test_report_pdf_for_owner_only(account, client, db, outbox):
    client.post("/api/numbers/report", json={"number": "98000 66666", "category": "Scam call", "send_to_police": True}, headers=account["headers"])
    report = db.query(Report).one()
    owner = client.get(f"/api/reports/{report.id}/pdf", params={"token": account["token"]})
    assert owner.content.startswith(b"%PDF")
    other_token, _ = register(client, email="other@example.com", name="Other User")
    assert client.get(f"/api/reports/{report.id}/pdf", params={"token": other_token}).status_code == 404
