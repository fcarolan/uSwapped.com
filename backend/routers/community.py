import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import get_current_user, now_iso
from lib.db import db
from lib.notify import notify
from lib.search import is_trusted, item_matches, rating_stats, with_owner_ratings
from models.schemas import Item, Rating, SavedSearch, SavedSearchCreate, UserProfile

router = APIRouter()

MAX_SAVED = 10


def describe(s: dict) -> str:
    parts = [s.get("q") or s.get("category") or "anything"]
    if s.get("q") and s.get("category"):
        parts.append(f"in {s['category']}")
    if s.get("location"):
        parts.append(f"near {s['location']}")
    return " ".join(parts)


@router.get("/users/{user_id}", response_model=UserProfile)
async def profile(user_id: str):
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not u:
        raise HTTPException(status_code=404, detail="Swapper not found")
    avg, count = rating_stats(u)
    ratings = await db.ratings.find({"ratee_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(20)
    items = await db.items.find({"owner_id": user_id, "status": "available"}, {"_id": 0}).sort("created_at", -1).to_list(50)
    done = await db.swaps.count_documents({
        "$or": [
            {"proposer_id": user_id, "proposer_received_at": {"$ne": None}},
            {"owner_id": user_id, "owner_received_at": {"$ne": None}},
        ]
    })
    return UserProfile(
        user_id=user_id, name=u["name"], picture=u.get("picture"), member_since=u["created_at"],
        rating_avg=avg, rating_count=count, trusted=is_trusted(avg, count), swaps_completed=done,
        ratings=[Rating(**r) for r in ratings], items=[Item(**d) for d in await with_owner_ratings(items)],
    )


@router.get("/saved-searches", response_model=List[SavedSearch])
async def list_saved(user: dict = Depends(get_current_user)):
    docs = await db.saved_searches.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(MAX_SAVED)
    return [SavedSearch(**d) for d in docs]


@router.post("/saved-searches", response_model=SavedSearch)
async def create_saved(body: SavedSearchCreate, user: dict = Depends(get_current_user)):
    data = {"q": body.q.strip(), "category": body.category, "location": body.location.strip()}
    if not (data["q"] or data["category"] or data["location"]):
        raise HTTPException(status_code=400, detail="Add a keyword, category or location to save a search")
    if await db.saved_searches.find_one({"user_id": user["user_id"], **data}):
        raise HTTPException(status_code=400, detail="You already saved this search")
    if await db.saved_searches.count_documents({"user_id": user["user_id"]}) >= MAX_SAVED:
        raise HTTPException(status_code=400, detail=f"You can save up to {MAX_SAVED} searches")
    s = SavedSearch(id=str(uuid.uuid4()), user_id=user["user_id"], created_at=now_iso(), **data)
    await db.saved_searches.insert_one(s.model_dump())
    return s


@router.delete("/saved-searches/{id}")
async def delete_saved(id: str, user: dict = Depends(get_current_user)):
    r = await db.saved_searches.delete_one({"id": id, "user_id": user["user_id"]})
    if r.deleted_count != 1:
        raise HTTPException(status_code=404, detail="Saved search not found")
    return {"ok": True}


async def alert_saved_searches(item: dict) -> None:
    """Notify every other user whose saved search matches a newly listed item (one alert per user)."""
    notified: set[str] = set()
    async for s in db.saved_searches.find({"user_id": {"$ne": item["owner_id"]}}, {"_id": 0}):
        if s["user_id"] in notified or not item_matches(item, s.get("q", ""), s.get("category"), s.get("location", "")):
            continue
        notified.add(s["user_id"])
        await notify(s["user_id"], "saved_search", f"New match: {item['title']}",
                     f"Just listed for your search \u201c{describe(s)}\u201d \u00b7 {item['location']}", f"/items/{item['id']}")

