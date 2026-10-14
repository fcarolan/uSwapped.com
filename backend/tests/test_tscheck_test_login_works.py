"""Criterion: Test login still works after the seed.py change (no hardcoded session token
   baked into seed.py; test session only seeded when SEED_TEST_SESSION_TOKEN is set)."""

TEST_SESSION_TOKEN = "test_session_uswapped"


def test_auth_me_with_seeded_test_session(client):
    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["user_id"] == "user_test_swapper"
    assert body["name"] == "Test Swapper"


def test_auth_me_with_cookie_session(client):
    resp = client.get("/auth/me", cookies={"session_token": TEST_SESSION_TOKEN})
    assert resp.status_code == 200, resp.text
    assert resp.json()["user_id"] == "user_test_swapper"


def test_auth_me_rejects_bogus_token(client):
    resp = client.get("/auth/me", headers={"Authorization": "Bearer not_a_real_token"})
    assert resp.status_code in (401, 403), resp.text
