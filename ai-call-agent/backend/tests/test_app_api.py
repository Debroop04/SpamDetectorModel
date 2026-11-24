import json

from app.config import settings
from app.models import SpamNumber


def test_sync_gives_the_phone_its_lists(account, client, db):
    headers = account["headers"]
    client.put("/api/numbers/rules", json={"number": "+919000011111", "kind": "block"}, headers=headers)
    client.put("/api/numbers/rules", json={"number": "+919000022222", "kind": "allow"}, headers=headers)
    db.add(SpamNumber(number="+919000099999", category="Lottery or prize scam", reports=4, source="community"))
    db.add(SpamNumber(number="+919000088888", category="Telemarketing", reports=1, source="community"))
    db.commit()

    data = client.get("/api/me/sync", headers=headers).json()
    assert data["blocked"] == ["+919000011111"]
    assert data["trusted"] == ["+919000022222"]
    dangerous = {d["number"] for d in data["dangerous"]}
    assert "+919000099999" in dangerous
    assert "+919000088888" not in dangerous
    assert data["line_number"] == "+15005550006"
    assert data["user"]["email"] == "asha@example.com"
    assert client.get("/api/me/sync").status_code == 401


def test_app_info_is_public_and_reads_apk_version(client, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "APK_DIR", str(tmp_path))
    info = client.get("/api/app/info").json()
    assert info["latest"] is None
    assert info["public_server"] == "https://shield.example.com"
    assert all(s.startswith("http://") and s.endswith(":8000") for s in info["lan_servers"])

    (tmp_path / "version.json").write_text(json.dumps({"versionCode": 3, "versionName": "1.2.0", "url": "/downloads/call-shield.apk"}))
    assert client.get("/api/app/info").json()["latest"]["versionName"] == "1.2.0"


def test_website_on_the_same_wifi_is_allowed_by_cors(client):
    def preflight(origin):
        return client.options(
            "/api/auth/login",
            headers={"Origin": origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"},
        )

    for origin in ("http://192.168.1.20:3000", "http://10.21.3.191:3000", "http://172.20.0.5:3000", "http://localhost:3000"):
        assert preflight(origin).headers.get("access-control-allow-origin") == origin, origin
    for origin in ("http://evil.example.com", "http://10.21.3.191.evil.com:3000"):
        assert preflight(origin).headers.get("access-control-allow-origin") is None, origin
