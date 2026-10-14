import asyncio
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import get_current_user, now_iso
from lib.db import db
from lib.search import items_query, with_owner_ratings
from models.schemas import Item, ItemCreate
from routers.community import alert_saved_searches

router = APIRouter()


@router.get("/items", response_model=List[Item])
async def list_items(q: str = "", category: Optional[str] = None, location: str = ""):
    docs = await db.items.find(items_query(q, category, location), {"_id": 0}).sort("created_at", -1).to_list(500)
    return [Item(**d) for d in await with_owner_ratings(docs)]


@router.get("/items/mine", response_model=List[Item])
async def my_items(user: dict = Depends(get_current_user)):
    docs = await db.items.find({"owner_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [Item(**d) for d in docs]


@router.get("/items/{id}", response_model=Item)
async def get_item(id: str):
    doc = await db.items.find_one({"id": id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Item not found")
    return Item(**(await with_owner_ratings([doc]))[0])


@router.post("/items", response_model=Item)
async def create_item(body: ItemCreate, user: dict = Depends(get_current_user)):
    for url in body.images:
        if not url.startswith("/api/images/"):
            raise HTTPException(status_code=400, detail="Please upload your photos")
        img = await db.images.find_one({"id": url.rsplit("/", 1)[-1]}, {"_id": 0, "owner_id": 1})
        if not img or img["owner_id"] != user["user_id"]:
            raise HTTPException(status_code=400, detail="One of the photos could not be found, please re-upload it")
    item = Item(
        **body.model_dump(), image_url=body.images[0], id=str(uuid.uuid4()), owner_id=user["user_id"], owner_name=user["name"],
        owner_picture=user.get("picture"), created_at=now_iso(),
    )
    await db.items.insert_one(item.model_dump())
    asyncio.create_task(alert_saved_searches(item.model_dump()))
    return item


@router.delete("/items/{id}")
async def delete_item(id: str, user: dict = Depends(get_current_user)):
    doc = await db.items.find_one({"id": id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Item not found")
    if doc["owner_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not your item")
    if doc["status"] == "swapped":
        raise HTTPException(status_code=400, detail="Swapped items can't be deleted")
    await db.items.delete_one({"id": id})
    await db.swaps.update_many(
        {"status": "pending", "$or": [{"target_item.id": id}, {"offered_item.id": id}]},
        {"$set": {"status": "cancelled"}},
    )
    return {"ok": True}
