"""Idempotent seed: demo swappers + listings + a test user/session. Run: python seed.py"""
import asyncio
import uuid
from datetime import datetime, timedelta, timezone

from lib.credits import credits_for_value
from lib.db import db, ensure_indexes

U = "https://images.unsplash.com/"
DEMO_USERS = [
    {"user_id": "user_demo_aoife", "email": "aoife.demo@uswapped.com", "name": "Aoife Byrne",
     "picture": "https://api.dicebear.com/7.x/thumbs/svg?seed=aoife"},
    {"user_id": "user_demo_luca", "email": "luca.demo@uswapped.com", "name": "Luca Romano",
     "picture": "https://api.dicebear.com/7.x/thumbs/svg?seed=luca"},
    {"user_id": "user_demo_sophie", "email": "sophie.demo@uswapped.com", "name": "Sophie Martin",
     "picture": "https://api.dicebear.com/7.x/thumbs/svg?seed=sophie"},
]
TEST_USER = {"user_id": "user_test_swapper", "email": "test.swapper@uswapped.com", "name": "Test Swapper",
             "picture": "https://api.dicebear.com/7.x/thumbs/svg?seed=test"}
TEST_TOKEN = "test_session_uswapped"

ITEMS = [
    ("seed-camera", 0, "Vintage Rangefinder Camera", "Fully working 35mm rangefinder with leather strap. Shutter fires at all speeds.", "Electronics", "Good", 140, U + "26/camera-keys.jpg?w=900&q=80", "Dublin"),
    ("seed-typewriter", 1, "Mint Green Retro Typewriter", "Lovely 1960s portable typewriter, new ribbon fitted. Great desk piece.", "Collectibles", "Good", 85, U + "photo-1708102399096-b01391f99fbb?w=900&q=80", "Milan"),
    ("seed-sneakers", 2, "Streetwear Sneakers (EU 42)", "Worn twice, box included. Swapping because they're half a size too small.", "Fashion", "Like new", 65, U + "photo-1576788448817-9b4ddb64e4fa?w=900&q=80", "Lyon"),
    ("seed-headphones", 0, "Noise-Cancelling Headphones", "Over-ear wireless headphones, 30h battery, case and cable included.", "Electronics", "Like new", 220, U + "photo-1618366712010-f4ae9c647dcb?w=900&q=80", "Cork"),
    ("seed-guitar", 1, "Acoustic Guitar + Soft Case", "Warm-sounding dreadnought, recently restrung. Perfect for beginners.", "Music & Vinyl", "Good", 120, U + "photo-1510915361894-db8b60106cb1?w=900&q=80", "Rome"),
    ("seed-vinyl", 2, "Indie Vinyl Bundle (12 LPs)", "A dozen indie & alt-rock records from the 2000s, all play cleanly.", "Music & Vinyl", "Good", 48, U + "photo-1596633313465-1256feb1c6d9?w=900&q=80", "Paris"),
    ("seed-console", 0, "Retro Games Console Bundle", "Classic console with two controllers and five cartridges. Tested and working.", "Toys & Games", "Fair", 310, U + "photo-1550745165-9bc0b252726f?w=900&q=80", "Galway"),
    ("seed-books", 1, "Paperback Novel Bundle", "Eight contemporary fiction paperbacks. Light reading marks only.", "Books", "Good", 8, U + "photo-1610116306796-6fea9f4fae38?w=900&q=80", "Turin"),
    ("seed-bike", 2, "White City Bicycle", "Single-speed city bike, 54cm frame. Collection or courier at my cost.", "Sports & Outdoors", "Good", 180, U + "photo-1501147830916-ce44a6359892?w=900&q=80", "Bordeaux"),
    ("seed-jacket", 0, "Vintage Denim Jacket", "Classic 90s denim jacket, size M. Soft and broken in.", "Fashion", "Good", 30, U + "photo-1768145488790-185e20abfd08?w=900&q=80", "Dublin"),
]

TEST_ITEMS = [
    ("seed-test-lamp", "Mid-century Desk Lamp", "Brass desk lamp with a new bulb.", "Home & Garden", "Like new", 40, U + "photo-1777869356086-b0351f541ae7?w=900&q=80", "Dublin"),
]


async def main():
    await ensure_indexes()
    now = datetime.now(timezone.utc)
    for u in DEMO_USERS + [TEST_USER]:
        if not await db.users.find_one({"user_id": u["user_id"]}):
            await db.users.insert_one({**u, "credits": 50, "created_at": now.isoformat()})
    all_items = [(s, DEMO_USERS[o], *rest) for s, o, *rest in ITEMS] + [(s, TEST_USER, *rest) for s, *rest in TEST_ITEMS]
    for i, (sid, owner, title, desc, cat, cond, value, img, loc) in enumerate(all_items):
        if await db.items.find_one({"id": sid}):
            continue
        await db.items.insert_one({
            "id": sid, "owner_id": owner["user_id"], "owner_name": owner["name"], "owner_picture": owner["picture"],
            "title": title, "description": desc, "category": cat, "condition": cond, "value_eur": float(value),
            "image_url": img, "location": loc, "credit_cost": credits_for_value(value), "status": "available",
            "created_at": (now - timedelta(hours=i)).isoformat(),
        })
    await db.user_sessions.update_one(
        {"session_token": TEST_TOKEN},
        {"$set": {"user_id": TEST_USER["user_id"], "session_token": TEST_TOKEN,
                  "expires_at": now + timedelta(days=365), "created_at": now.isoformat()}},
        upsert=True,
    )
    print("seeded", await db.items.count_documents({}), "items")


if __name__ == "__main__":
    asyncio.run(main())
