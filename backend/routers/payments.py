"""Stripe checkout for swap processing fees + optional shipping labels (claimable sandbox, Flow A)."""
import asyncio
import os
import secrets
import uuid
from datetime import datetime, timezone
from typing import List

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response

from lib.auth import get_current_user, now_iso
from lib.db import db
from lib.fees import LABEL_SIZES, label_size
from lib.labels import DEMO_CARRIER, render_label_pdf
from models.schemas import (
    CheckoutResponse, LabelCheckout, LabelSize, PaymentRecord, PaymentStatus, ShippingLabel, SwapFeeCheckout,
)
from routers.swaps import accepted_party, confirm_swap, expire_overdue

router = APIRouter()
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
TAX_MODE = "full"  # IE sandbox, digital marketplace service

PRODUCT_KEYS = {"swap_fee": "uswapped_processing_fee", "label": "uswapped_shipping_label"}
_product_ids: dict[str, str] = {}


def _product_id(kind: str) -> str:
    """Products are created by setup_stripe.py; amounts are dynamic so we use inline price_data."""
    if kind not in _product_ids:
        for p in stripe.Product.list(active=True, limit=100).auto_paging_iter():
            key = p.to_dict().get("metadata", {}).get("emergent_product_id")
            for k, v in PRODUCT_KEYS.items():
                if key == v:
                    _product_ids[k] = p.id
    if kind not in _product_ids:
        raise HTTPException(status_code=500, detail="Payments are not configured yet")
    return _product_ids[kind]


def _create_session(kind: str, amount_cents: int, kwargs: dict):
    line = {"price_data": {"currency": "eur", "product": _product_id(kind), "unit_amount": amount_cents}, "quantity": 1}
    base = dict(line_items=[line], mode="payment", **kwargs)
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


async def _start_checkout(user: dict, kind: str, amount_cents: int, description: str, origin_url: str,
                          swap_id: str, label_id: str | None = None) -> CheckoutResponse:
    origin = origin_url.rstrip("/")
    session = await asyncio.to_thread(_create_session, kind, amount_cents, dict(
        success_url=f"{origin}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{origin}/payment/cancel?swap_id={swap_id}",
        metadata={"user_id": user["user_id"], "kind": kind, "swap_id": swap_id, "label_id": label_id or ""},
    ))
    await db.payment_transactions.insert_one({
        "session_id": session.id, "user_id": user["user_id"], "kind": kind, "swap_id": swap_id,
        "label_id": label_id, "description": description, "amount_cents": amount_cents, "currency": "eur",
        "status": "initiated", "payment_status": "pending", "fulfilled": False,
        "created_at": now_iso(), "updated_at": datetime.now(timezone.utc),
    })
    return CheckoutResponse(checkout_url=session.url, session_id=session.id)


@router.get("/shipping/sizes", response_model=List[LabelSize])
async def shipping_sizes():
    return [LabelSize(**label_size(s["id"])) for s in LABEL_SIZES]


@router.post("/payments/swap-fee", response_model=CheckoutResponse)
async def swap_fee_checkout(body: SwapFeeCheckout, user: dict = Depends(get_current_user)):
    await expire_overdue()
    swap = await db.swaps.find_one({"id": body.swap_id}, {"_id": 0})
    if not swap or swap["proposer_id"] != user["user_id"]:
        raise HTTPException(status_code=404, detail="Swap not found")
    if swap["status"] == "expired":
        raise HTTPException(status_code=400, detail="The 48-hour payment window has passed. Make a new offer to try again.")
    if swap["status"] != "awaiting_payment":
        raise HTTPException(status_code=400, detail="This swap doesn't need a payment right now")
    return await _start_checkout(user, "swap_fee", swap["fee_cents"],
                                 f"Processing fee · {swap['target_item']['title']}", body.origin_url, swap["id"])


@router.post("/payments/label", response_model=CheckoutResponse)
async def label_checkout(body: LabelCheckout, user: dict = Depends(get_current_user)):
    swap, role, _ = await accepted_party(body.swap_id, user)
    if swap.get(f"{role}_label_id"):
        raise HTTPException(status_code=400, detail="You already bought a label for this swap")
    size = label_size(body.size)
    label = ShippingLabel(
        id=str(uuid.uuid4()), swap_id=swap["id"], user_id=user["user_id"], size=body.size,
        price_cents=size["price_cents"], sender=body.sender, recipient=body.recipient,
        status="pending_payment", carrier=DEMO_CARRIER, created_at=now_iso(),
    )
    await db.shipping_labels.insert_one(label.model_dump())
    return await _start_checkout(user, "label", label.price_cents, f"Shipping label · {size['label']}",
                                 body.origin_url, swap["id"], label.id)


async def _fulfil(tx: dict) -> None:
    if tx["kind"] == "swap_fee":
        await confirm_swap(tx["swap_id"])
        return
    tracking = f"DEMO-USW-{secrets.token_hex(4).upper()}"
    lab = await db.shipping_labels.find_one_and_update(
        {"id": tx["label_id"], "status": "pending_payment"},
        {"$set": {"status": "paid", "tracking_number": tracking}})
    if lab:
        swap = await db.swaps.find_one({"id": lab["swap_id"]}, {"_id": 0})
        role = "proposer" if swap and swap["proposer_id"] == lab["user_id"] else "owner"
        await db.swaps.update_one({"id": lab["swap_id"]},
                                  {"$set": {f"{role}_label_id": lab["id"], f"{role}_tracking": tracking}})


async def _mark_paid(session_id: str, payment_intent=None):
    await db.payment_transactions.update_one(
        {"session_id": session_id, "payment_status": {"$ne": "paid"}},
        {"$set": {"status": "completed", "payment_status": "paid", "stripe_payment_intent_id": payment_intent,
                  "updated_at": datetime.now(timezone.utc)}},
    )
    # fulfil exactly once (DB updated first, then fulfilment)
    tx = await db.payment_transactions.find_one_and_update(
        {"session_id": session_id, "payment_status": "paid", "fulfilled": False}, {"$set": {"fulfilled": True}})
    if tx:
        await _fulfil(tx)


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
    return PaymentStatus(session_id=session_id, status=record["status"], payment_status=record["payment_status"],
                         kind=record["kind"], swap_id=record["swap_id"], label_id=record.get("label_id"))


@router.get("/payments/history", response_model=List[PaymentRecord])
async def payment_history(user: dict = Depends(get_current_user)):
    docs = await db.payment_transactions.find(
        {"user_id": user["user_id"], "kind": {"$exists": True}, "payment_status": "paid"}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return [PaymentRecord(**d) for d in docs]


@router.get("/labels/{id}", response_model=ShippingLabel)
async def get_label(id: str, user: dict = Depends(get_current_user)):
    lab = await db.shipping_labels.find_one({"id": id, "user_id": user["user_id"]}, {"_id": 0})
    if not lab:
        raise HTTPException(status_code=404, detail="Label not found")
    return ShippingLabel(**lab)


@router.get("/labels/{id}/pdf")
async def label_pdf(id: str, user: dict = Depends(get_current_user)):
    lab = await db.shipping_labels.find_one({"id": id, "user_id": user["user_id"]}, {"_id": 0})
    if not lab:
        raise HTTPException(status_code=404, detail="Label not found")
    if lab["status"] != "paid":
        raise HTTPException(status_code=402, detail="Label isn't paid yet")
    swap = await db.swaps.find_one({"id": lab["swap_id"]}, {"_id": 0})
    role = "proposer" if swap["proposer_id"] == user["user_id"] else "owner"
    item_title = (swap["offered_item"] if role == "proposer" else swap["target_item"])["title"]
    pdf = await asyncio.to_thread(render_label_pdf, lab, item_title)
    return Response(pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="uswapped-label-{lab["tracking_number"]}.pdf"'})


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
