"""Criterion: Admin login and portal access control.
   Admin credentials sign in and can reach /api/admin/*; anonymous requests get 401;
   a signed-in non-admin gets 403."""
import httpx

ADMIN_EMAIL = "fcarolan@gmail.com"
ADMIN_PASSWORD = "Uswap-6DXZHQyx3AuzcCNr"
NON_ADMIN_TOKEN = "test_session_uswapped"


def test_admin_stats_anonymous_401(client: httpx.Client):
    resp = client.get("/admin/stats")
    assert resp.status_code == 401, resp.text


def test_admin_stats_non_admin_403(client: httpx.Client):
    resp = client.get("/admin/stats", headers={"Authorization": f"Bearer {NON_ADMIN_TOKEN}"})
    assert resp.status_code == 403, resp.text


def test_admin_login_and_access(client: httpx.Client):
    # the session cookie is set with secure=True; httpx's cookiejar (correctly) won't replay a
    # secure cookie over this http:// test connection, so carry the token as a Bearer header instead
    # (exactly what a mobile client / the browser-over-https would do).
    login = client.post("/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert login.status_code == 200, login.text
    me = login.json()
    assert me["role"] == "admin"
    token = login.cookies.get("session_token")
    assert token, "expected a session_token cookie from /auth/login"
    auth_header = {"Authorization": f"Bearer {token}"}

    stats = client.get("/admin/stats", headers=auth_header)
    assert stats.status_code == 200, stats.text
    body = stats.json()
    assert "users" in body and "open_reports" in body

    users = client.get("/admin/users", headers=auth_header)
    assert users.status_code == 200, users.text
    assert isinstance(users.json(), list)
