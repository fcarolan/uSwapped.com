"""Criterion: Email + password auth on /login.
   Register creates an account and signs in; wrong password errors; duplicate email -> 409;
   5 failed logins for one email -> 429 (lockout)."""
import uuid

import httpx


def _rand_email() -> str:
    return f"qa+{uuid.uuid4().hex[:10]}@example.com"


def test_register_then_login_and_duplicate_email(client: httpx.Client):
    email = _rand_email()
    password = "supersecret123"

    reg = client.post("/auth/register", json={"name": "QA Tscheck", "email": email, "password": password})
    assert reg.status_code == 200, reg.text
    body = reg.json()
    assert body["email"] == email
    assert body["role"] == "user"

    # duplicate registration -> 409
    dup = client.post("/auth/register", json={"name": "QA Tscheck 2", "email": email, "password": "anotherpass123"})
    assert dup.status_code == 409, dup.text

    # fresh client (no cookie) can sign in with correct password
    with httpx.Client(base_url=client.base_url, timeout=30.0) as fresh:
        login_ok = fresh.post("/auth/login", json={"email": email, "password": password})
        assert login_ok.status_code == 200, login_ok.text
        assert login_ok.json()["email"] == email

    # wrong password -> 401 (use a distinct email so we don't trip the lockout test below)
    with httpx.Client(base_url=client.base_url, timeout=30.0) as fresh2:
        bad = fresh2.post("/auth/login", json={"email": email, "password": "wrongpassword1"})
        assert bad.status_code == 401, bad.text


def test_login_lockout_after_five_failures(client: httpx.Client):
    email = _rand_email()
    password = "supersecret123"
    reg = client.post("/auth/register", json={"name": "QA Lockout", "email": email, "password": password})
    assert reg.status_code == 200, reg.text

    with httpx.Client(base_url=client.base_url, timeout=30.0) as fresh:
        last = None
        for _ in range(5):
            last = fresh.post("/auth/login", json={"email": email, "password": "wrongpassword1"})
        assert last.status_code == 401, last.text

        locked = fresh.post("/auth/login", json={"email": email, "password": password})
        assert locked.status_code == 429, locked.text
