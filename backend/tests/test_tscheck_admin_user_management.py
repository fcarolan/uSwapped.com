"""Criterion: Admin user management (suspend/unsuspend, role toggle, delete).
   Exercised end-to-end over HTTP against a throwaway qa+<suffix>@example.com account,
   never against real seeded users."""
import uuid

import httpx

ADMIN_EMAIL = "fcarolan@gmail.com"
ADMIN_PASSWORD = "Uswap-6DXZHQyx3AuzcCNr"


def _admin_auth_header(client: httpx.Client) -> dict:
    login = client.post("/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert login.status_code == 200, login.text
    assert login.json()["role"] == "admin"
    token = login.cookies.get("session_token")
    assert token, "expected a session_token cookie from /auth/login"
    return {"Authorization": f"Bearer {token}"}


def _throwaway_user(client: httpx.Client) -> tuple[str, str, str]:
    suffix = uuid.uuid4().hex[:10]
    email = f"qa+tscheck-{suffix}@example.com"
    password = "supersecret123"
    reg = client.post("/auth/register", json={"name": "TSCheck Backend User", "email": email, "password": password})
    assert reg.status_code == 200, reg.text
    return reg.json()["user_id"], email, password


def test_suspend_blocks_login_and_unsuspend_restores(client: httpx.Client):
    admin_auth = _admin_auth_header(client)
    user_id, email, password = _throwaway_user(client)

    suspend = client.post(f"/admin/users/{user_id}/suspend", json={"suspended": True}, headers=admin_auth)
    assert suspend.status_code == 200, suspend.text

    blocked_login = client.post("/auth/login", json={"email": email, "password": password})
    assert blocked_login.status_code == 403, blocked_login.text

    unsuspend = client.post(f"/admin/users/{user_id}/suspend", json={"suspended": False}, headers=admin_auth)
    assert unsuspend.status_code == 200, unsuspend.text

    ok_login = client.post("/auth/login", json={"email": email, "password": password})
    assert ok_login.status_code == 200, ok_login.text


def test_role_toggle_and_delete(client: httpx.Client):
    admin_auth = _admin_auth_header(client)
    user_id, email, password = _throwaway_user(client)

    make_admin = client.post(f"/admin/users/{user_id}/role", json={"role": "admin"}, headers=admin_auth)
    assert make_admin.status_code == 200, make_admin.text
    users = client.get("/admin/users", params={"q": email}, headers=admin_auth).json()
    assert users and users[0]["role"] == "admin"

    revoke = client.post(f"/admin/users/{user_id}/role", json={"role": "user"}, headers=admin_auth)
    assert revoke.status_code == 200, revoke.text
    users = client.get("/admin/users", params={"q": email}, headers=admin_auth).json()
    assert users and users[0]["role"] == "user"

    delete = client.delete(f"/admin/users/{user_id}", headers=admin_auth)
    assert delete.status_code == 200, delete.text
    final_login = client.post("/auth/login", json={"email": email, "password": password})
    assert final_login.status_code == 401, final_login.text


def test_user_actions_require_admin(client: httpx.Client):
    user_id, _, _ = _throwaway_user(client)
    resp = client.post(
        f"/admin/users/{user_id}/suspend",
        json={"suspended": True},
        headers={"Authorization": "Bearer test_session_uswapped"},
    )
    assert resp.status_code == 403, resp.text
