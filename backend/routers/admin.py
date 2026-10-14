"""Admin portal API. Every route requires role == "admin"; every write is recorded in admin_audit."""
import asyncio
import re
import uuid
from typing import List, Optional

import stripe
from fastapi import APIRouter, Depends, HTTPException

from lib.auth import now_iso, require_admin
from lib.db import db
from lib.notify import notify
from lib.search import rating_stats
from models.schemas import (
    AdminActionResult, AdminStats, AdminTransaction, AdminUser, AuditEntry, Item, RemoveItemBody, Report,
    ReportResolve, RoleBody, SuspendBody, Swap,
)

router = APIRouter(prefix="/admin")
OPEN_SWAP = ["pending", "awaiting_payment"]


async def _audit(admin: dict, action: str, target: str, detail: str = "") -> None:
    await db.admin_audit.insert_one(AuditEntry(
        id=str(uuid.uuid4()), admin_id=admin["user_id"], admin_name=admin["name"], action=action,
        target=target, detail=detail, created_at=now_iso()).model_dump())


def _rx(q: str) -> dict:
    return {"$regex": re.escape(q.strip()), "$options": "i"}


async def _cancel_open_swaps(query: dict) -> int:
    """Cancels pending/awaiting-payment swaps matching `query` and frees any items they had reserved."""
    swaps = await db.swaps.find({**query, "status": {"$in": OPEN_SWAP}}, {"_id": 0}).to_list(1000)
    for s in swaps:
        await db.swaps.update_one({"id": s["id"]}, {"$set": {"status": "cancelled"}})
        if s["status"] == "awaiting_payment":
            await db.items.update_many(
                {"id": {"$in": [s["target_item"]["id"], s["offered_item"]["id"]]}, "status": "reserved"},
                {"$set": {"status": "available"}})
    return len(swaps)


async def _remove_items(query: dict, reason: str) -> int:
    items = await db.items.find({**query, "status": {"$ne": "removed"}}, {"_id": 0, "id": 1}).to_list(5000)
    ids = [i["id"] for i in items]
    if not ids:
        return 0
    await db.items.update_many({"id": {"$in": ids}}, {"$set": {"status": "removed", "removed_reason": reason}})
    await _cancel_open_swaps({"$or": [{"target_item.id": {"$in": ids}}, {"offered_item.id": {"$in": ids}}]})
    return len(ids)


async def _target_user(user_id: str, admin: dict) -> dict:
    if user_id == admin["user_id"]:
        raise HTTPException(status_code=400, detail="You can't do that to your own account")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ---------- overview ----------
@router.get("/stats", response_model=AdminStats)
async def stats(_: dict = Depends(require_admin)):
    by_status = {d["_id"]: d["n"] async for d in db.swaps.aggregate([{"$group": {"_id": "$status", "n": {"$sum": 1}}}])}
    money = {d["_id"]: d["c"] async for d in db.payment_transactions.aggregate([
        {"$match": {"payment_status": {"$in": ["paid", "refunded"]}}},
        {"$group": {"_id": "$payment_status", "c": {"$sum": "$amount_cents"}}}])}
    users, suspended, available, removed, reports = await asyncio.gather(
        db.users.count_documents({}), db.users.count_documents({"suspended": True}),
        db.items.count_documents({"status": "available"}), db.items.count_documents({"status": "removed"}),
        db.reports.count_documents({"status": "open"}))
    return AdminStats(users=users, suspended_users=suspended, items_available=available, items_removed=removed,
                      swaps_by_status=by_status, open_reports=reports, revenue_cents=money.get("paid", 0),
                      refunded_cents=money.get("refunded", 0))


# ---------- reports ----------
@router.get("/reports", response_model=List[Report])
async def list_reports(status: str = "open", _: dict = Depends(require_admin)):
    query = {} if status == "all" else {"status": status}
    return [Report(**d) for d in await db.reports.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)]


@router.post("/reports/{id}/resolve", response_model=Report)
async def resolve_report(id: str, body: ReportResolve, admin: dict = Depends(require_admin)):
    report = await db.reports.find_one({"id": id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if body.action == "remove_item":
        await _remove_items({"id": report["item_id"]}, f"Reported: {report['reason']}")
        await notify(report["item_owner_id"], "swap_declined", "Listing removed",
                     f"{report['item_title']} was removed for breaking our listing rules.", "/dashboard?tab=listings")
        # one decision closes every open report on that item
        await db.reports.update_many({"item_id": report["item_id"], "status": "open"}, {"$set": {
            "status": "item_removed", "resolved_by": admin["name"], "resolved_at": now_iso()}})
    else:
        await db.reports.update_one({"id": id}, {"$set": {
            "status": "dismissed", "resolved_by": admin["name"], "resolved_at": now_iso()}})
    await _audit(admin, f"report_{body.action}", report["item_title"], report["reason"])
    return Report(**await db.reports.find_one({"id": id}, {"_id": 0}))


# ---------- listings ----------
@router.get("/items", response_model=List[Item])
async def list_items(q: str = "", status: str = "all", _: dict = Depends(require_admin)):
    query: dict = {} if status == "all" else {"status": status}
    if q.strip():
        query["$or"] = [{"title": _rx(q)}, {"owner_name": _rx(q)}, {"location": _rx(q)}, {"id": q.strip()}]
    return [Item(**d) for d in await db.items.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)]


@router.post("/items/{id}/remove", response_model=AdminActionResult)
async def remove_item(id: str, body: RemoveItemBody, admin: dict = Depends(require_admin)):
    item = await db.items.find_one({"id": id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if not await _remove_items({"id": id}, body.reason):
        raise HTTPException(status_code=400, detail="Already removed")
    await notify(item["owner_id"], "swap_declined", "Listing removed",
                 f"{item['title']} was removed: {body.reason}", "/dashboard?tab=listings")
    await db.reports.update_many({"item_id": id, "status": "open"}, {"$set": {
        "status": "item_removed", "resolved_by": admin["name"], "resolved_at": now_iso()}})
    await _audit(admin, "remove_item", item["title"], body.reason)
    return AdminActionResult(detail="Listing removed")


@router.post("/items/{id}/restore", response_model=AdminActionResult)
async def restore_item(id: str, admin: dict = Depends(require_admin)):
    res = await db.items.update_one({"id": id, "status": "removed"}, {"$set": {"status": "available"},
                                                                    "$unset": {"removed_reason": ""}})
    if res.modified_count != 1:
        raise HTTPException(status_code=400, detail="Only removed listings can be restored")
    item = await db.items.find_one({"id": id}, {"_id": 0, "title": 1})
    await _audit(admin, "restore_item", item["title"])
    return AdminActionResult(detail="Listing restored")


# ---------- users ----------
@router.get("/users", response_model=List[AdminUser])
async def list_users(q: str = "", _: dict = Depends(require_admin)):
    query = {"$or": [{"name": _rx(q)}, {"email": _rx(q)}]} if q.strip() else {}
    users = await db.users.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    ids = [u["user_id"] for u in users]
    listings = {d["_id"]: d["n"] async for d in db.items.aggregate([
        {"$match": {"owner_id": {"$in": ids}, "status": {"$ne": "removed"}}}, {"$group": {"_id": "$owner_id", "n": {"$sum": 1}}}])}
    out = []
    for u in users:
        avg, count = rating_stats(u)
        swaps = await db.swaps.count_documents({"$or": [{"proposer_id": u["user_id"]}, {"owner_id": u["user_id"]}]})
        auth = "password" if u.get("password_hash") else ("facebook" if u.get("facebook_id") else "google")
        base = {k: u.get(k) for k in ("user_id", "email", "name", "picture", "created_at")}
        out.append(AdminUser(**base, role=u.get("role", "user"), suspended=bool(u.get("suspended")), auth=auth,
                             listings=listings.get(u["user_id"], 0), swaps=swaps, rating_avg=avg, rating_count=count))
    return out


@router.post("/users/{user_id}/suspend", response_model=AdminActionResult)
async def suspend_user(user_id: str, body: SuspendBody, admin: dict = Depends(require_admin)):
    user = await _target_user(user_id, admin)
    await db.users.update_one({"user_id": user_id}, {"$set": {"suspended": body.suspended}})
    if body.suspended:
        await db.user_sessions.delete_many({"user_id": user_id})  # sign them out everywhere
        await _cancel_open_swaps({"$or": [{"proposer_id": user_id}, {"owner_id": user_id}]})
    await _audit(admin, "suspend_user" if body.suspended else "unsuspend_user", user["email"])
    return AdminActionResult(detail="User suspended" if body.suspended else "User restored")


@router.post("/users/{user_id}/remove-listings", response_model=AdminActionResult)
async def remove_user_listings(user_id: str, admin: dict = Depends(require_admin)):
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "email": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    n = await _remove_items({"owner_id": user_id}, "Removed by an admin")
    await _audit(admin, "remove_user_listings", user["email"], f"{n} listings")
    return AdminActionResult(detail=f"Removed {n} listing{'s' if n != 1 else ''}")


@router.post("/users/{user_id}/role", response_model=AdminActionResult)
async def set_role(user_id: str, body: RoleBody, admin: dict = Depends(require_admin)):
    user = await _target_user(user_id, admin)
    await db.users.update_one({"user_id": user_id}, {"$set": {"role": body.role}})
    await _audit(admin, f"set_role_{body.role}", user["email"])
    return AdminActionResult(detail=f"{user['name']} is now {'an admin' if body.role == 'admin' else 'a regular user'}")


@router.delete("/users/{user_id}", response_model=AdminActionResult)
async def delete_user(user_id: str, admin: dict = Depends(require_admin)):
    user = await _target_user(user_id, admin)
    await _remove_items({"owner_id": user_id}, "Account deleted")
    await _cancel_open_swaps({"$or": [{"proposer_id": user_id}, {"owner_id": user_id}]})
    for coll in ("user_sessions", "saved_searches", "push_subscriptions", "notifications"):
        await db[coll].delete_many({"user_id": user_id})
    await db.users.delete_one({"user_id": user_id})
    # payment records are kept for accounting; swaps/ratings keep the name snapshot
    await _audit(admin, "delete_user", user["email"])
    return AdminActionResult(detail="Account permanently deleted")


# ---------- swaps ----------
@router.get("/swaps", response_model=List[Swap])
async def list_swaps(status: str = "all", q: str = "", _: dict = Depends(require_admin)):
    query: dict = {} if status == "all" else {"status": status}
    if q.strip():
        query["$or"] = [{"proposer_name": _rx(q)}, {"owner_name": _rx(q)}, {"target_item.title": _rx(q)},
                        {"offered_item.title": _rx(q)}]
    return [Swap(**d) for d in await db.swaps.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)]


@router.post("/swaps/{id}/cancel", response_model=AdminActionResult)
async def cancel_swap(id: str, admin: dict = Depends(require_admin)):
    if not await _cancel_open_swaps({"id": id}):
        raise HTTPException(status_code=400, detail="Only pending or awaiting-fee swaps can be cancelled")
    await _audit(admin, "cancel_swap", id)
    return AdminActionResult(detail="Swap cancelled")


# ---------- transactions ----------
def _refundable(tx: dict) -> bool:
    pi = tx.get("stripe_payment_intent_id") or ""
    return tx.get("payment_status") == "paid" and pi.startswith("pi_") and pi != "pi_sim"


@router.get("/transactions", response_model=List[AdminTransaction])
async def list_transactions(status: Optional[str] = None, _: dict = Depends(require_admin)):
    query = {"payment_status": status} if status else {}
    txs = await db.payment_transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    users = {u["user_id"]: u async for u in db.users.find(
        {"user_id": {"$in": list({t["user_id"] for t in txs})}}, {"_id": 0, "user_id": 1, "name": 1, "email": 1})}
    return [AdminTransaction(
        session_id=t["session_id"], user_id=t["user_id"], user_name=users.get(t["user_id"], {}).get("name"),
        user_email=users.get(t["user_id"], {}).get("email"), kind=t["kind"], description=t["description"],
        amount_cents=t["amount_cents"], payment_status=t["payment_status"], swap_id=t["swap_id"],
        refundable=_refundable(t), created_at=t["created_at"]) for t in txs]


@router.post("/transactions/{session_id}/refund", response_model=AdminActionResult)
async def refund(session_id: str, admin: dict = Depends(require_admin)):
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if not _refundable(tx):
        raise HTTPException(status_code=400, detail="This payment can't be refunded (not paid, already refunded, or a test record)")
    try:
        await asyncio.to_thread(stripe.Refund.create, payment_intent=tx["stripe_payment_intent_id"],
                                metadata={"refunded_by": admin["user_id"]})
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=502, detail=f"Stripe refused the refund: {e.user_message or 'unknown error'}")
    await db.payment_transactions.update_one({"session_id": session_id}, {"$set": {
        "payment_status": "refunded", "status": "refunded", "refunded_at": now_iso()}})
    await notify(tx["user_id"], "swap_declined", "Refund issued",
                 f"We've refunded {tx['amount_cents'] / 100:.2f} EUR for {tx['description']}.", "/dashboard?tab=payments")
    await _audit(admin, "refund", tx["description"], f"€{tx['amount_cents'] / 100:.2f}")
    return AdminActionResult(detail="Refund issued")


# ---------- audit ----------
@router.get("/audit", response_model=List[AuditEntry])
async def audit_log(_: dict = Depends(require_admin)):
    return [AuditEntry(**d) for d in await db.admin_audit.find({}, {"_id": 0}).sort("created_at", -1).to_list(300)]
