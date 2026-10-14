"""Criterion: Admin remove/restore listing with reason.
   Uses a fresh fixture item owned by the test-swapper account, never a seeded listing."""
import uuid

import httpx

ADMIN_EMAIL = "fcarolan@gmail.com"
ADMIN_PASSWORD = "Uswap-6DXZHQyx3AuzcCNr"
OWNER_AUTH = {"Authorization": "Bearer test_session_uswapped"}


def _admin_auth_header(client: httpx.Client) -> dict:
    login = client.post("/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert login.status_code == 200, login.text
    assert login.json()["role"] == "admin"
    token = login.cookies.get("session_token")
    assert token, "expected a session_token cookie from /auth/login"
    return {"Authorization": f"Bearer {token}"}


def _fixture_item(client: httpx.Client) -> dict:
    suffix = uuid.uuid4().hex[:8]
    upload = client.post(
        "/uploads",
        headers=OWNER_AUTH,
        files={"file": ("icon.png", b"\x89PNG\r\n\x1a\nfakepngbytes", "image/png")},
    )
    assert upload.status_code == 200, upload.text
    image_url = upload.json()["url"]
    item = client.post(
        "/items",
        headers=OWNER_AUTH,
        json={
            "title": f"tscheck-admin-remove-{suffix}",
            "description": "Backend fixture item for admin remove/restore test",
            "category": "Other",
            "condition": "Good",
            "value_eur": 9,
            "location": "Dundalk",
            "images": [image_url],
        },
    )
    assert item.status_code == 200, item.text
    return item.json()


def test_remove_hides_item_and_restore_brings_it_back(client: httpx.Client):
    admin_auth = _admin_auth_header(client)
    item = _fixture_item(client)
    item_id = item["id"]

    remove = client.post(f"/admin/items/{item_id}/remove", json={"reason": "tscheck backend removal"}, headers=admin_auth)
    assert remove.status_code == 200, remove.text

    public_get = client.get(f"/items/{item_id}")
    assert public_get.status_code == 404, public_get.text

    restore = client.post(f"/admin/items/{item_id}/restore", headers=admin_auth)
    assert restore.status_code == 200, restore.text

    restored_get = client.get(f"/items/{item_id}")
    assert restored_get.status_code == 200, restored_get.text
    assert restored_get.json()["status"] == "available"


def test_remove_requires_admin(client: httpx.Client):
    item = _fixture_item(client)
    resp = client.post(
        f"/admin/items/{item['id']}/remove",
        json={"reason": "not an admin"},
        headers=OWNER_AUTH,
    )
    assert resp.status_code == 403, resp.text
