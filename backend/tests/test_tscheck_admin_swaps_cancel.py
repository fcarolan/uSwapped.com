"""Criterion: Admin swaps review — cancelling a pending swap frees the reserved items."""
import uuid

import httpx

ADMIN_EMAIL = "fcarolan@gmail.com"
ADMIN_PASSWORD = "Uswap-6DXZHQyx3AuzcCNr"
OWNER_AUTH = {"Authorization": "Bearer test_session_uswapped"}
AOIFE_AUTH = {"Authorization": "Bearer tmp_aoife"}


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
            "title": f"tscheck-admin-swap-cancel-{suffix}",
            "description": "Backend fixture item for admin swap cancel test",
            "category": "Other",
            "condition": "Good",
            "value_eur": 9,
            "location": "Dundalk",
            "images": [image_url],
        },
    )
    assert item.status_code == 200, item.text
    return item.json()


def test_admin_cancel_frees_reserved_items(client: httpx.Client):
    admin_auth = _admin_auth_header(client)
    item = _fixture_item(client)

    create = client.post(
        "/swaps",
        headers=OWNER_AUTH,
        json={"target_item_id": "seed-headphones", "offered_item_id": item["id"], "message": "tscheck admin swap cancel backend"},
    )
    assert create.status_code == 200, create.text
    swap = create.json()

    accept = client.post(f"/swaps/{swap['id']}/accept", headers=AOIFE_AUTH)
    assert accept.status_code == 200, accept.text
    reserved = client.get(f"/items/{item['id']}")
    assert reserved.json()["status"] == "reserved"

    cancel = client.post(f"/admin/swaps/{swap['id']}/cancel", headers=admin_auth)
    assert cancel.status_code == 200, cancel.text

    freed = client.get(f"/items/{item['id']}")
    assert freed.json()["status"] == "available", freed.text

    swaps_list = client.get("/admin/swaps?status=cancelled", headers=admin_auth)
    assert swaps_list.status_code == 200, swaps_list.text
    assert any(s["id"] == swap["id"] for s in swaps_list.json())


def test_admin_cancel_requires_admin(client: httpx.Client):
    item = _fixture_item(client)
    create = client.post(
        "/swaps",
        headers=OWNER_AUTH,
        json={"target_item_id": "seed-headphones", "offered_item_id": item["id"], "message": "tscheck admin swap cancel backend 2"},
    )
    assert create.status_code == 200, create.text
    swap = create.json()
    resp = client.post(f"/admin/swaps/{swap['id']}/cancel", headers=OWNER_AUTH)
    assert resp.status_code == 403, resp.text
    # cleanup: cancel it ourselves so this fixture item doesn't linger reserved
    client.post(f"/swaps/{swap['id']}/cancel", headers=OWNER_AUTH)
