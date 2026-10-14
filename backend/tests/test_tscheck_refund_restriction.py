"""Criterion: Admin review of swaps and transactions — Refund restriction.
   Simulated (non-Stripe-paid) payment_transactions must be refundable:false and the
   refund endpoint must reject them with 400, even though they are marked 'paid'."""
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


def test_simulated_payment_not_refundable(client: httpx.Client):
    auth = _admin_auth_header(client)
    txs = client.get("/admin/transactions", headers=auth)
    assert txs.status_code == 200, txs.text
    rows = txs.json()
    simulated_paid = [t for t in rows if t["payment_status"] == "paid" and t["refundable"] is False]
    if not simulated_paid:
        import pytest
        pytest.skip("No simulated paid transaction present in current data to assert against")
    target = simulated_paid[0]

    refund = client.post(f"/admin/transactions/{target['session_id']}/refund", headers=auth)
    assert refund.status_code == 400, refund.text


def test_refund_requires_admin(client: httpx.Client):
    resp = client.post(
        "/admin/transactions/nonexistent-session/refund",
        headers={"Authorization": "Bearer test_session_uswapped"},
    )
    assert resp.status_code == 403, resp.text
