"""Criterion: Report a listing + admin review queue (API layer).
   A signed-in non-owner can report a listing; a non-admin can't resolve reports (403);
   an admin can dismiss the report, which then shows under status=dismissed."""
import httpx

ADMIN_EMAIL = "fcarolan@gmail.com"
ADMIN_PASSWORD = "Uswap-6DXZHQyx3AuzcCNr"
REPORTER_TOKEN = "test_session_uswapped"  # Test Swapper — does not own seed-camera
TARGET_ITEM = "seed-camera"  # owned by demo user aoife


def test_report_create_then_admin_dismiss(client: httpx.Client):
    details = "tscheck-report-listing automated check"
    create = client.post(
        "/reports",
        json={"item_id": TARGET_ITEM, "reason": "misleading", "details": details},
        headers={"Authorization": f"Bearer {REPORTER_TOKEN}"},
    )
    # allow "already reported" (400) from a prior un-resolved run to not block the suite
    if create.status_code == 400 and "already reported" in create.text.lower():
        import pytest
        pytest.skip("An open tscheck report already exists for this fixture; resolve it manually to re-run clean")
    assert create.status_code == 200, create.text
    report = create.json()
    assert report["status"] == "open"
    assert report["item_id"] == TARGET_ITEM

    # non-admin cannot resolve
    denied = client.post(
        f"/admin/reports/{report['id']}/resolve",
        json={"action": "dismiss"},
        headers={"Authorization": f"Bearer {REPORTER_TOKEN}"},
    )
    assert denied.status_code == 403, denied.text

    # admin dismisses it (secure cookie won't replay over http in this test client, so use the
    # token as a Bearer header — same approach a mobile client / https browser session would use)
    login = client.post("/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert login.status_code == 200, login.text
    token = login.cookies.get("session_token")
    assert token
    admin_auth = {"Authorization": f"Bearer {token}"}

    resolved = client.post(f"/admin/reports/{report['id']}/resolve", json={"action": "dismiss"}, headers=admin_auth)
    assert resolved.status_code == 200, resolved.text
    assert resolved.json()["status"] == "dismissed"

    listed = client.get("/admin/reports?status=dismissed", headers=admin_auth)
    assert listed.status_code == 200, listed.text
    assert any(r["id"] == report["id"] for r in listed.json())
