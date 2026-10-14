"""Criterion: Facebook disabled + refactored callback is safe.
   /auth/providers must report facebook:false (no keys configured), and the refactored
   /auth/facebook/callback helper must redirect to /login?error=facebook_denied rather than
   erroring or logging anyone in when called with no params."""


def test_providers_facebook_disabled(client):
    resp = client.get("/auth/providers")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["facebook"] is False
    assert body["google"] is True


def test_facebook_callback_without_params_redirects_denied(client):
    resp = client.get("/auth/facebook/callback", follow_redirects=False)
    assert resp.status_code in (302, 307), resp.text
    location = resp.headers.get("location", "")
    assert location.endswith("/login?error=facebook_denied"), location
    # must not set a session cookie on this failure path
    assert "session_token" not in resp.cookies
