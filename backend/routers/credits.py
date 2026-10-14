"""Swap Credit packs + Stripe checkout (claimable sandbox, Flow A)."""
import asyncio
import os
import uuid
from datetime import datetime, timezone
from typing import List

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request

from lib.auth import get_current_user, now_iso
from lib.credits import CREDIT_PACKS, pack_by_id
from lib.db import db
from models.schemas import CheckoutRequest, CheckoutResponse, CreditPack, CreditTx, PaymentStatus

router = APIRouter()
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
TAX_MODE = "full"  # IE sandbox + digital goods


@router.get("/credits/packs", response_model=List[CreditPack])
async def packs():
    return [CreditPack(**p) for p in CREDIT_PACKS]


@router.get("/credits/history", response_model=List[CreditTx])
async def history(user: dict = Depends(get_current_user)):
    docs = await db.credit_transactions.find({"user_id": user["user_id"]}, {"_id": 0}) \
        .sort("created_at", -1).to_list(200)
    return [CreditTx(**d) for d in docs]


def _create_session(price_id: str, kwargs: dict):
    base = dict(line_items=[{"price": price_id, "quantity": 1}], mode="payment", **kwargs)
    if TAX_MODE == "full":
        try:
            return stripe.checkout.Session.create(**base, managed_payments={"enabled": True})
        except stripe.error.InvalidRequestError as e:
            msg = (e.user_message or str(e)).lower()
            if "managed payments" not in msg and "ineligible" not in msg and "managed_payments" not in msg:
                raise
    try:
        return stripe.checkout.Session.create(**base, automatic_tax={"enabled": True},
                                              billing_address_collection="required")
    except stripe.error.InvalidRequestError:
        return stripe.checkout.Session.create(**base)


@router.post("/payments/checkout", response_model=CheckoutResponse)
async def checkout(body: CheckoutRequest, user: dict = Depends(get_current_user)):
    pack = pack_by_id(body.pack_id)
    if not pack:
        raise HTTPException(status_code=404, detail="Unknown credit pack")
    prices = (await asyncio.to_thread(stripe.Price.list, lookup_keys=[pack["lookup_key"]], active=True, limit=1)).data
    if not prices:
        raise HTTPException(status_code=500, detail="Price not configured")
    origin = body.origin_url.rstrip("/")
    session = await asyncio.to_thread(_create_session, prices[0].id, dict(
        success_url=f"{origin}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{origin}/payment/cancel",
        metadata={"user_id": user["user_id"], "pack_id": pack["id"], "credits": str(pack["credits"])},
    ))
    await db.payment_transactions.insert_one({
        "session_id": session.id, "user_id": user["user_id"], "pack_id": pack["id"],
        "credits": pack["credits"], "amount": pack["amount_cents"] / 100.0, "currency": "eur",
        "status": "initiated", "payment_status": "pending", "credited": False,
        "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc),
    })
    return CheckoutResponse(checkout_url=session.url, session_id=session.id)


async def _mark_paid(session_id: str, payment_intent=None):
    await db.payment_transactions.update_one(
        {"session_id": session_id, "payment_status": {"$ne": "paid"}},
        {"$set": {"status": "completed", "payment_status": "paid", "stripe_payment_intent_id": payment_intent,
                  "updated_at": datetime.now(timezone.utc)}},
    )
    # grant credits exactly once (DB updated first, then fulfilment)
    tx = await db.payment_transactions.find_one_and_update(
        {"session_id": session_id, "payment_status": "paid", "credited": False}, {"$set": {"credited": True}})
    if tx:
        await db.users.update_one({"user_id": tx["user_id"]}, {"$inc": {"credits": tx["credits"]}})
        await db.credit_transactions.insert_one({
            "id": str(uuid.uuid4()), "user_id": tx["user_id"], "amount": tx["credits"],
            "reason": f"Purchased {tx['credits']} credits (€{tx['amount']:.2f})", "created_at": now_iso(),
        })


@router.get("/payments/status/{session_id}", response_model=PaymentStatus)
async def payment_status(session_id: str):
    record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if record.get("payment_status") != "paid":
        try:
            s = await asyncio.to_thread(stripe.checkout.Session.retrieve, session_id)
            if s.payment_status == "paid" or s.status == "complete":
                await _mark_paid(session_id, s.payment_intent)
            elif s.status == "expired":
                await db.payment_transactions.update_one(
                    {"session_id": session_id}, {"$set": {"status": "expired", "payment_status": "expired"}})
            record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        except stripe.error.StripeError:
            pass
    return PaymentStatus(session_id=session_id, status=record["status"],
                         payment_status=record["payment_status"], credits=record["credits"])


@router.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except (stripe.error.SignatureVerificationError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid signature")
    obj, t = event["data"]["object"], event["type"]
    if t in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
        if obj.get("payment_status") == "paid" or t.endswith("succeeded"):
            await _mark_paid(obj["id"], obj.get("payment_intent"))
    elif t == "checkout.session.async_payment_failed":
        await db.payment_transactions.update_one({"session_id": obj["id"]},
                                                 {"$set": {"status": "failed", "payment_status": "failed"}})
    elif t == "checkout.session.expired":
        await db.payment_transactions.update_one({"session_id": obj["id"], "payment_status": {"$ne": "paid"}},
                                                 {"$set": {"status": "expired", "payment_status": "expired"}})
    elif t == "charge.refunded":
        await db.payment_transactions.update_one({"stripe_payment_intent_id": obj.get("payment_intent")},
                                                 {"$set": {"status": "refunded", "payment_status": "refunded"}})
    return {"status": "ok"}
