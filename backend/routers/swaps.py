import uuid

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import get_current_user, now_iso
from lib.db import db
from models.schemas import ItemSummary, Swap, SwapCreate, SwapLists

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
    return await _to_swap(await db.swaps.find_one({"id": id}, {"_id": 0}), user["user_id"])


@router.post("/{id}/decline", response_model=Swap)
async def decline(id: str, user: dict = Depends(get_current_user)):
    doc = await _get_pending(id)
    if doc["owner_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Only the item owner can decline")
    await db.swaps.update_one({"id": id}, {"$set": {"status": "declined"}})
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
