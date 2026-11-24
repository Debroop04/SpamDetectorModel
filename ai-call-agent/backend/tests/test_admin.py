from sqlalchemy import create_engine, text

from app.cli import create_user
from tests.conftest import register


def admin_headers(client):
    create_user("Super Admin", "admin@example.com", "Admin@12345", admin=True)
    token = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "Admin@12345"}).json()["token"]
    return {"Authorization": f"Bearer {token}"}


def test_regular_users_cannot_open_admin(account, client):
    assert client.get("/api/admin/overview", headers=account["headers"]).status_code == 403
    assert client.get("/api/admin/users", headers=account["headers"]).status_code == 403


def test_admin_sees_platform_and_manages_users(account, client, outbox):
    client.post("/api/numbers/report", json={"number": "98000 12345", "category": "Lottery or prize scam", "send_to_police": True}, headers=account["headers"])
    headers = admin_headers(client)

    me = client.get("/api/auth/me", headers=headers).json()
    assert me["role"] == "admin"

    overview = client.get("/api/admin/overview", headers=headers).json()
    assert overview["users"] == 2
    assert overview["admins"] == 1
    assert overview["reports_sent"] == 1
    assert len(overview["last_7_days"]) == 7

    users = client.get("/api/admin/users", headers=headers).json()
    asha = next(u for u in users if u["email"] == "asha@example.com")
    assert asha["reports"] == 1

    reports = client.get("/api/admin/reports", headers=headers).json()
    assert reports[0]["user_email"] == "asha@example.com"

    promoted = client.patch(f"/api/admin/users/{asha['id']}", json={"role": "admin"}, headers=headers)
    assert promoted.json()["role"] == "admin"

    own_id = me["id"]
    assert client.patch(f"/api/admin/users/{own_id}", json={"role": "user"}, headers=headers).status_code == 400
    assert client.delete(f"/api/admin/users/{own_id}", headers=headers).status_code == 400

    _, other = register(client, email="remove@example.com", name="Remove Me")
    assert client.delete(f"/api/admin/users/{other['id']}", headers=headers).status_code == 204
    assert all(u["email"] != "remove@example.com" for u in client.get("/api/admin/users", headers=headers).json())


def test_old_database_gets_role_column(tmp_path, monkeypatch):
    import app.database as database

    legacy = create_engine(f"sqlite:///{tmp_path}/legacy.db")
    with legacy.begin() as conn:
        conn.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY, name VARCHAR(120), email VARCHAR(255), password_hash VARCHAR(255))"))
        conn.execute(text("INSERT INTO users (name, email, password_hash) VALUES ('Old', 'old@example.com', 'x')"))
    monkeypatch.setattr(database, "engine", legacy)
    database.ensure_schema()
    with legacy.connect() as conn:
        assert conn.execute(text("SELECT role FROM users")).scalar() == "user"
