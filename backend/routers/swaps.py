import uuid
from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import get_current_user, now_iso
from lib.db import db
from lib.fees import PAYMENT_WINDOW_HOURS, processing_fee_cents
from lib.notify import notify
from models.schemas import ItemSummary, Message, MessageCreate, PostedUpdate, Rating, RatingCreate, Swap, SwapCreate, SwapLists

router = APIRouter(prefix="/swaps")


def _item_ids(doc: dict) -> list[str]:
    return [doc["target_item"]["id"], doc["offered_item"]["id"]]


async def expire_overdue() -> None:
    """Lazily expire accepted-but-unpaid swaps and put their items back on the market."""
    now = now_iso()
    async for doc in db.swaps.find({"status": "awaiting_payment", "payment_due_at": {"$lt": now}}, {"_id": 0}):
        r = await db.swaps.update_one({"id": doc["id"], "status": "awaiting_payment"}, {"$set": {"status": "expired"}})
        if r.modified_count == 1:
            await db.items.update_many({"id": {"$in": _item_ids(doc)}, "status": "reserved"}, {"$set": {"status": "available"}})


async def _to_swap(doc: dict, viewer_id: str) -> Swap:
    swap = Swap(**{k: v for k, v in doc.items() if k != "counterpart_email"})
    if swap.status == "accepted":  # contact details only once the fee is paid and the swap is confirmed
        other = swap.owner_id if viewer_id == swap.proposer_id else swap.proposer_id
        u = await db.users.find_one({"user_id": other}, {"_id": 0, "email": 1})
        swap.counterpart_email = u["email"] if u else None
    return swap


async def confirm_swap(swap_id: str) -> bool:
    """Called once the proposer's processing fee is paid. Idempotent."""
    doc = await db.swaps.find_one({"id": swap_id}, {"_id": 0})
    if not doc or doc["status"] == "accepted":
        return bool(doc)
    ids = _item_ids(doc)
    if await db.items.count_documents({"id": {"$in": ids}, "status": "swapped"}):
        return False  # paid after expiry and an item was swapped elsewhere -> needs manual refund
    r = await db.swaps.update_one({"id": swap_id, "status": {"$in": ["awaiting_payment", "expired"]}},
                                  {"$set": {"status": "accepted", "fee_paid": True}})
    if r.modified_count != 1:
        return False
    await db.items.update_many({"id": {"$in": ids}}, {"$set": {"status": "swapped"}})
    await db.swaps.update_many(
        {"status": {"$in": ["pending", "awaiting_payment"]}, "id": {"$ne": swap_id},
         "$or": [{"target_item.id": {"$in": ids}}, {"offered_item.id": {"$in": ids}}]},
        {"$set": {"status": "cancelled"}},
    )
    await notify(doc["owner_id"], "swap_confirmed", "Swap confirmed! \U0001F389",
                 f"{doc['proposer_name']} completed the swap for your {doc['target_item']['title']}. Time to post it!",
                 f"/swaps/{swap_id}/chat")
    await notify(doc["proposer_id"], "swap_confirmed", "You're all set! \U0001F389",
                 f"Your swap for {doc['target_item']['title']} is confirmed. Say hi and post your item.",
                 f"/swaps/{swap_id}/chat")
    return True


@router.get("", response_model=SwapLists)
async def list_swaps(user: dict = Depends(get_current_user)):
    await expire_overdue()
    uid = user["user_id"]
    inc = await db.swaps.find({"owner_id": uid}, {"_id": 0}).sort("created_at", -1).to_list(500)
    out = await db.swaps.find({"proposer_id": uid}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return SwapLists(incoming=[await _to_swap(d, uid) for d in inc],
                     outgoing=[await _to_swap(d, uid) for d in out])


@router.post("", response_model=Swap)
async def propose(body: SwapCreate, user: dict = Depends(get_current_user)):
    target = await db.items.find_one({"id": body.target_item_id}, {"_id": 0})
    offered = await db.items.find_one({"id": body.offered_item_id}, {"_id": 0})
    if not target or not offered:
        raise HTTPException(status_code=404, detail="Item not found")
    if offered["owner_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="You can only offer your own items")
    if target["owner_id"] == user["user_id"]:
        raise HTTPException(status_code=400, detail="You can't swap with yourself")
    if target["status"] != "available" or offered["status"] != "available":
        raise HTTPException(status_code=400, detail="One of these items is no longer available")
    dup = await db.swaps.find_one({"status": "pending", "target_item.id": target["id"], "offered_item.id": offered["id"]})
    if dup:
        raise HTTPException(status_code=400, detail="You already proposed this swap")
    owner = await db.users.find_one({"user_id": target["owner_id"]}, {"_id": 0})
    swap = Swap(
        id=str(uuid.uuid4()), proposer_id=user["user_id"], proposer_name=user["name"],
        owner_id=target["owner_id"], owner_name=owner["name"] if owner else target["owner_name"],
        target_item=ItemSummary(**target), offered_item=ItemSummary(**offered),
        fee_cents=processing_fee_cents(target["value_eur"]), message=body.message, created_at=now_iso(),
    )
    await db.swaps.insert_one(swap.model_dump(exclude={"counterpart_email"}))
    await notify(swap.owner_id, "swap_offer", "New swap offer!",
                 f"{user['name']} offered {offered['title']} for your {target['title']}", "/dashboard?tab=incoming")
    return swap


async def _get_status(id: str, *allowed: str) -> dict:
    await expire_overdue()
    doc = await db.swaps.find_one({"id": id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Swap not found")
    if doc["status"] not in allowed:
        raise HTTPException(status_code=400, detail=f"Swap is already {doc['status'].replace('_', ' ')}")
    return doc


@router.post("/{id}/accept", response_model=Swap)
async def accept(id: str, user: dict = Depends(get_current_user)):
    doc = await _get_status(id, "pending")
    if doc["owner_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Only the item owner can accept")
    ids = _item_ids(doc)
    # reserve both items atomically-ish: only proceed if both were available
    r = await db.items.update_many({"id": {"$in": ids}, "status": "available"}, {"$set": {"status": "reserved"}})
    if r.modified_count != 2:
        await db.items.update_many({"id": {"$in": ids}, "status": "reserved"}, {"$set": {"status": "available"}})
        raise HTTPException(status_code=400, detail="One of these items is no longer available")
    due = (datetime.now(timezone.utc) + timedelta(hours=PAYMENT_WINDOW_HOURS)).isoformat()
    locked = await db.swaps.update_one({"id": id, "status": "pending"},
                                       {"$set": {"status": "awaiting_payment", "payment_due_at": due}})
    if locked.modified_count != 1:
        await db.items.update_many({"id": {"$in": ids}}, {"$set": {"status": "available"}})
        raise HTTPException(status_code=409, detail="Swap was updated, refresh and try again")
    fee = f"\u20ac{doc['fee_cents'] / 100:.2f}"
    await notify(doc["proposer_id"], "swap_accepted", "Offer accepted! Complete your swap",
                 f"{user['name']} accepted your offer for {doc['target_item']['title']}. Pay the {fee} processing fee within 48h to confirm.",
                 "/dashboard?tab=outgoing")
    return await _to_swap(await db.swaps.find_one({"id": id}, {"_id": 0}), user["user_id"])


@router.post("/{id}/decline", response_model=Swap)
async def decline(id: str, user: dict = Depends(get_current_user)):
    doc = await _get_status(id, "pending")
    if doc["owner_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Only the item owner can decline")
    await db.swaps.update_one({"id": id}, {"$set": {"status": "declined"}})
    await notify(doc["proposer_id"], "swap_declined", "Offer declined",
                 f"Your offer for {doc['target_item']['title']} wasn't accepted this time.", "/dashboard?tab=outgoing")
    doc["status"] = "declined"
    return Swap(**doc)


@router.post("/{id}/cancel", response_model=Swap)
async def cancel(id: str, user: dict = Depends(get_current_user)):
    doc = await _get_status(id, "pending", "awaiting_payment")
    if doc["proposer_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Only the proposer can cancel")
    r = await db.swaps.update_one({"id": id, "status": doc["status"]}, {"$set": {"status": "cancelled"}})
    if r.modified_count == 1 and doc["status"] == "awaiting_payment":
        await db.items.update_many({"id": {"$in": _item_ids(doc)}, "status": "reserved"}, {"$set": {"status": "available"}})
    doc["status"] = "cancelled"
    return Swap(**doc)


async def _party_swap(id: str, user: dict) -> dict:
    await expire_overdue()
    doc = await db.swaps.find_one({"id": id}, {"_id": 0})
    if not doc or user["user_id"] not in (doc["proposer_id"], doc["owner_id"]):
        raise HTTPException(status_code=404, detail="Swap not found")
    return doc


@router.get("/{id}", response_model=Swap)
async def get_swap(id: str, user: dict = Depends(get_current_user)):
    return await _to_swap(await _party_swap(id, user), user["user_id"])


@router.get("/{id}/messages", response_model=List[Message])
async def list_messages(id: str, user: dict = Depends(get_current_user)):
    await _party_swap(id, user)
    docs = await db.messages.find({"swap_id": id}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return [Message(**d) for d in docs]


@router.post("/{id}/messages", response_model=Message)
async def send_message(id: str, body: MessageCreate, user: dict = Depends(get_current_user)):
    doc = await _party_swap(id, user)
    if doc["status"] != "accepted":
        raise HTTPException(status_code=400, detail="Chat opens once the swap is confirmed")
    text = body.body.strip()
    if not text:
        raise HTTPException(status_code=422, detail="Message can't be empty")
    msg = Message(id=str(uuid.uuid4()), swap_id=id, sender_id=user["user_id"], sender_name=user["name"],
                  body=text, created_at=now_iso())
    await db.messages.insert_one(msg.model_dump())
    other = doc["owner_id"] if user["user_id"] == doc["proposer_id"] else doc["proposer_id"]
    await notify(other, "message", f"Message from {user['name'].split(' ')[0]}", text[:120], f"/swaps/{id}/chat")
    return msg


async def accepted_party(id: str, user: dict) -> tuple[dict, str, str]:
    """Returns (swap, my_role, other_user_id) for a confirmed swap the user is part of."""
    doc = await _party_swap(id, user)
    if doc["status"] != "accepted":
        raise HTTPException(status_code=400, detail="Postage starts once the swap is confirmed")
    role = "proposer" if user["user_id"] == doc["proposer_id"] else "owner"
    other = doc["owner_id"] if role == "proposer" else doc["proposer_id"]
    return doc, role, other


def _my_item(doc: dict, role: str) -> dict:
    return doc["offered_item"] if role == "proposer" else doc["target_item"]


def _their_item(doc: dict, role: str) -> dict:
    return doc["target_item"] if role == "proposer" else doc["offered_item"]


@router.post("/{id}/posted", response_model=Swap)
async def mark_posted(id: str, body: PostedUpdate, user: dict = Depends(get_current_user)):
    doc, role, other = await accepted_party(id, user)
    tracking = body.tracking.strip() or doc.get(f"{role}_tracking")
    if doc.get(f"{role}_posted_at"):
        await db.swaps.update_one({"id": id}, {"$set": {f"{role}_tracking": tracking}})  # allow tracking edits
    else:
        await db.swaps.update_one({"id": id}, {"$set": {f"{role}_posted_at": now_iso(), f"{role}_tracking": tracking}})
        first = user["name"].split(" ")[0]
        extra = f" Tracking: {tracking}" if tracking else ""
        await notify(other, "swap_posted", f"{first} posted your item \U0001F4E6",
                     f"{_my_item(doc, role)['title']} is on its way.{extra}", f"/swaps/{id}/chat")
    return await _to_swap(await db.swaps.find_one({"id": id}, {"_id": 0}), user["user_id"])


@router.post("/{id}/received", response_model=Swap)
async def mark_received(id: str, user: dict = Depends(get_current_user)):
    doc, role, other = await accepted_party(id, user)
    if not doc.get(f"{role}_received_at"):
        await db.swaps.update_one({"id": id}, {"$set": {f"{role}_received_at": now_iso()}})
        first = user["name"].split(" ")[0]
        await notify(other, "swap_received", f"{first} received your item \u2705",
                     f"{_their_item(doc, role)['title']} arrived safely.", f"/swaps/{id}/chat")
    return await _to_swap(await db.swaps.find_one({"id": id}, {"_id": 0}), user["user_id"])


@router.post("/{id}/rating", response_model=Rating)
async def rate(id: str, body: RatingCreate, user: dict = Depends(get_current_user)):
    doc, role, other = await accepted_party(id, user)
    if not doc.get(f"{role}_received_at"):
        raise HTTPException(status_code=400, detail="Mark your item as received before rating")
    locked = await db.swaps.update_one({"id": id, f"{role}_rated": {"$ne": True}}, {"$set": {f"{role}_rated": True}})
    if locked.modified_count != 1:
        raise HTTPException(status_code=400, detail="You already rated this swap")
    rating = Rating(
        id=str(uuid.uuid4()), swap_id=id, rater_id=user["user_id"], rater_name=user["name"],
        rater_picture=user.get("picture"), ratee_id=other, stars=body.stars, comment=body.comment.strip(),
        item_title=_their_item(doc, role)["title"], created_at=now_iso(),
    )
    await db.ratings.insert_one(rating.model_dump())
    await db.users.update_one({"user_id": other}, {"$inc": {"rating_sum": body.stars, "rating_count": 1}})
    stars = "\u2b50" * body.stars
    await notify(other, "rating", f"You got {stars} from {user['name'].split(' ')[0]}",
                 rating.comment[:120] or "Thanks for a great swap!", f"/users/{other}")
    return rating
