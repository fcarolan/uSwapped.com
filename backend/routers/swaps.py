import uuid

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import get_current_user, now_iso
from lib.db import db
from lib.notify import notify
from models.schemas import ItemSummary, Message, MessageCreate, PostedUpdate, Rating, RatingCreate, Swap, SwapCreate, SwapLists
from typing import List

router = APIRouter(prefix="/swaps")


def _summary(item: dict) -> dict:
    return ItemSummary(**item).model_dump()


async def _to_swap(doc: dict, viewer_id: str) -> Swap:
    swap = Swap(**{k: v for k, v in doc.items() if k != "counterpart_email"})
    if swap.status == "accepted":
        other = swap.owner_id if viewer_id == swap.proposer_id else swap.proposer_id
        u = await db.users.find_one({"user_id": other}, {"_id": 0, "email": 1})
        swap.counterpart_email = u["email"] if u else None
    return swap


async def _log(user_id: str, amount: int, reason: str):
    await db.credit_transactions.insert_one(
        {"id": str(uuid.uuid4()), "user_id": user_id, "amount": amount, "reason": reason, "created_at": now_iso()})


@router.get("", response_model=SwapLists)
async def list_swaps(user: dict = Depends(get_current_user)):
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
    if user["credits"] < target["credit_cost"]:
        raise HTTPException(status_code=402, detail=f"You need {target['credit_cost']} credits to propose this swap")
    dup = await db.swaps.find_one({"status": "pending", "target_item.id": target["id"], "offered_item.id": offered["id"]})
    if dup:
        raise HTTPException(status_code=400, detail="You already proposed this swap")
    owner = await db.users.find_one({"user_id": target["owner_id"]}, {"_id": 0})
    swap = Swap(
        id=str(uuid.uuid4()), proposer_id=user["user_id"], proposer_name=user["name"],
        owner_id=target["owner_id"], owner_name=owner["name"] if owner else target["owner_name"],
        target_item=ItemSummary(**target), offered_item=ItemSummary(**offered),
        proposer_cost=target["credit_cost"], owner_cost=offered["credit_cost"],
        message=body.message, created_at=now_iso(),
    )
    await db.swaps.insert_one(swap.model_dump(exclude={"counterpart_email"}))
    await notify(swap.owner_id, "swap_offer", "New swap offer!",
                 f"{user['name']} offered {offered['title']} for your {target['title']}", "/dashboard?tab=incoming")
    return swap


async def _get_pending(id: str) -> dict:
    doc = await db.swaps.find_one({"id": id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Swap not found")
    if doc["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Swap is already {doc['status']}")
    return doc


@router.post("/{id}/accept", response_model=Swap)
async def accept(id: str, user: dict = Depends(get_current_user)):
    doc = await _get_pending(id)
    if doc["owner_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Only the item owner can accept")
    items = await db.items.find({"id": {"$in": [doc["target_item"]["id"], doc["offered_item"]["id"]]},
                                 "status": "available"}).to_list(2)
    if len(items) != 2:
        raise HTTPException(status_code=400, detail="One of these items is no longer available")

    # lock the swap first so a double-click can't charge twice
    locked = await db.swaps.update_one({"id": id, "status": "pending"}, {"$set": {"status": "accepted"}})
    if locked.modified_count != 1:
        raise HTTPException(status_code=409, detail="Swap was updated, refresh and try again")

    owner_cost, proposer_cost = doc["owner_cost"], doc["proposer_cost"]
    r1 = await db.users.update_one({"user_id": doc["owner_id"], "credits": {"$gte": owner_cost}},
                                   {"$inc": {"credits": -owner_cost}})
    if r1.modified_count != 1:
        await db.swaps.update_one({"id": id}, {"$set": {"status": "pending"}})
        raise HTTPException(status_code=402, detail=f"You need {owner_cost} credits to accept this swap")
    r2 = await db.users.update_one({"user_id": doc["proposer_id"], "credits": {"$gte": proposer_cost}},
                                   {"$inc": {"credits": -proposer_cost}})
    if r2.modified_count != 1:
        await db.users.update_one({"user_id": doc["owner_id"]}, {"$inc": {"credits": owner_cost}})
        await db.swaps.update_one({"id": id}, {"$set": {"status": "pending"}})
        raise HTTPException(status_code=402, detail="The other swapper doesn't have enough credits right now")

    await _log(doc["owner_id"], -owner_cost, f"Swap: received {doc['offered_item']['title']}")
    await _log(doc["proposer_id"], -proposer_cost, f"Swap: received {doc['target_item']['title']}")
    item_ids = [doc["target_item"]["id"], doc["offered_item"]["id"]]
    await db.items.update_many({"id": {"$in": item_ids}}, {"$set": {"status": "swapped"}})
    await db.swaps.update_many(
        {"status": "pending", "id": {"$ne": id},
         "$or": [{"target_item.id": {"$in": item_ids}}, {"offered_item.id": {"$in": item_ids}}]},
        {"$set": {"status": "cancelled"}},
    )
    await notify(doc["proposer_id"], "swap_accepted", "Swap accepted! 🎉",
                 f"{user['name']} accepted your offer for {doc['target_item']['title']}. Say hi and arrange postage.",
                 f"/swaps/{id}/chat")
    return await _to_swap(await db.swaps.find_one({"id": id}, {"_id": 0}), user["user_id"])


@router.post("/{id}/decline", response_model=Swap)
async def decline(id: str, user: dict = Depends(get_current_user)):
    doc = await _get_pending(id)
    if doc["owner_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Only the item owner can decline")
    await db.swaps.update_one({"id": id}, {"$set": {"status": "declined"}})
    await notify(doc["proposer_id"], "swap_declined", "Offer declined",
                 f"Your offer for {doc['target_item']['title']} wasn't accepted this time.", "/dashboard?tab=outgoing")
    doc["status"] = "declined"
    return Swap(**doc)


@router.post("/{id}/cancel", response_model=Swap)
async def cancel(id: str, user: dict = Depends(get_current_user)):
    doc = await _get_pending(id)
    if doc["proposer_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Only the proposer can cancel")
    await db.swaps.update_one({"id": id}, {"$set": {"status": "cancelled"}})
    doc["status"] = "cancelled"
    return Swap(**doc)


async def _party_swap(id: str, user: dict) -> dict:
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
        raise HTTPException(status_code=400, detail="Chat opens once the swap is accepted")
    text = body.body.strip()
    if not text:
        raise HTTPException(status_code=422, detail="Message can't be empty")
    msg = Message(id=str(uuid.uuid4()), swap_id=id, sender_id=user["user_id"], sender_name=user["name"],
                  body=text, created_at=now_iso())
    await db.messages.insert_one(msg.model_dump())
    other = doc["owner_id"] if user["user_id"] == doc["proposer_id"] else doc["proposer_id"]
    await notify(other, "message", f"Message from {user['name'].split(' ')[0]}", text[:120], f"/swaps/{id}/chat")
    return msg


async def _accepted_party(id: str, user: dict) -> tuple[dict, str, str]:
    """Returns (swap, my_role, other_user_id) for an accepted swap the user is part of."""
    doc = await _party_swap(id, user)
    if doc["status"] != "accepted":
        raise HTTPException(status_code=400, detail="Postage tracking starts once the swap is accepted")
    role = "proposer" if user["user_id"] == doc["proposer_id"] else "owner"
    other = doc["owner_id"] if role == "proposer" else doc["proposer_id"]
    return doc, role, other


def _my_item(doc: dict, role: str) -> dict:
    return doc["offered_item"] if role == "proposer" else doc["target_item"]


def _their_item(doc: dict, role: str) -> dict:
    return doc["target_item"] if role == "proposer" else doc["offered_item"]


@router.post("/{id}/posted", response_model=Swap)
async def mark_posted(id: str, body: PostedUpdate, user: dict = Depends(get_current_user)):
    doc, role, other = await _accepted_party(id, user)
    tracking = body.tracking.strip() or None
    if doc.get(f"{role}_posted_at"):
        await db.swaps.update_one({"id": id}, {"$set": {f"{role}_tracking": tracking}})  # allow tracking edits
    else:
        await db.swaps.update_one({"id": id}, {"$set": {f"{role}_posted_at": now_iso(), f"{role}_tracking": tracking}})
        first = user["name"].split(" ")[0]
        extra = f" Tracking: {tracking}" if tracking else ""
        await notify(other, "swap_posted", f"{first} posted your item 📦",
                     f"{_my_item(doc, role)['title']} is on its way.{extra}", f"/swaps/{id}/chat")
    return await _to_swap(await db.swaps.find_one({"id": id}, {"_id": 0}), user["user_id"])


@router.post("/{id}/received", response_model=Swap)
async def mark_received(id: str, user: dict = Depends(get_current_user)):
    doc, role, other = await _accepted_party(id, user)
    if not doc.get(f"{role}_received_at"):
        await db.swaps.update_one({"id": id}, {"$set": {f"{role}_received_at": now_iso()}})
        first = user["name"].split(" ")[0]
        await notify(other, "swap_received", f"{first} received your item ✅",
                     f"{_their_item(doc, role)['title']} arrived safely.", f"/swaps/{id}/chat")
    return await _to_swap(await db.swaps.find_one({"id": id}, {"_id": 0}), user["user_id"])


@router.post("/{id}/rating", response_model=Rating)
async def rate(id: str, body: RatingCreate, user: dict = Depends(get_current_user)):
    doc, role, other = await _accepted_party(id, user)
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
    await notify(other, "rating", f"You got {'⭐' * body.stars} from {user['name'].split(' ')[0]}",
                 rating.comment[:120] or "Thanks for a great swap!", f"/users/{other}")
    return rating
