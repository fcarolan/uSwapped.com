"""Shared search matching (Browse + saved-search alerts) and owner-rating enrichment."""
import re
from typing import Optional

from lib.db import db

TRUSTED_MIN_COUNT = 3
TRUSTED_MIN_AVG = 4.5


def _stem(word: str) -> str:
    w = word.lower()
    if len(w) > 4 and w.endswith("es") and w[-3] in "sxz":
        return w[:-2]
    if len(w) > 3 and w.endswith("s") and not w.endswith("ss"):
        return w[:-1]
    return w


def terms(q: str) -> list[str]:
    return [_stem(t) for t in re.findall(r"[\w']+", q or "") if len(t) > 1]


def items_query(q: str = "", category: Optional[str] = None, location: str = "") -> dict:
    """Every search word must appear in title/description/location (plurals tolerated)."""
    query: dict = {"status": "available"}
    if category:
        query["category"] = category
    words = terms(q)
    if words:
        query["$and"] = [
            {"$or": [{f: {"$regex": re.escape(w), "$options": "i"}} for f in ("title", "description", "location")]}
            for w in words
        ]
    if location.strip():
        query["location"] = {"$regex": re.escape(location.strip()), "$options": "i"}
    return query


def item_matches(item: dict, q: str = "", category: Optional[str] = None, location: str = "") -> bool:
    if category and item["category"] != category:
        return False
    if location.strip() and location.strip().lower() not in item["location"].lower():
        return False
    hay = f"{item['title']} {item['description']} {item['location']}".lower()
    return all(w in hay for w in terms(q))


def rating_stats(user: Optional[dict]) -> tuple[Optional[float], int]:
    if not user or not user.get("rating_count"):
        return None, 0
    return round(user["rating_sum"] / user["rating_count"], 1), user["rating_count"]


def is_trusted(avg: Optional[float], count: int) -> bool:
    return avg is not None and count >= TRUSTED_MIN_COUNT and avg >= TRUSTED_MIN_AVG


async def with_owner_ratings(docs: list[dict]) -> list[dict]:
    ids = list({d["owner_id"] for d in docs})
    users = await db.users.find({"user_id": {"$in": ids}}, {"_id": 0, "user_id": 1, "rating_sum": 1, "rating_count": 1}).to_list(len(ids) or 1)
    by_id = {u["user_id"]: u for u in users}
    for d in docs:
        d["owner_rating_avg"], d["owner_rating_count"] = rating_stats(by_id.get(d["owner_id"]))
    return docs
