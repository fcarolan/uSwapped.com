"""bcrypt password hashing + simple per-email login lockout (5 failures -> 15 min)."""
from datetime import datetime, timedelta, timezone

import bcrypt

from lib.db import db

MAX_FAILURES = 5
LOCK_MINUTES = 15


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:
        return False


async def locked_until(email: str):
    doc = await db.login_attempts.find_one({"email": email}, {"_id": 0})
    until = doc.get("locked_until") if doc else None
    if until and until.replace(tzinfo=timezone.utc) > datetime.now(timezone.utc):
        return until
    return None


async def record_failure(email: str) -> None:
    doc = await db.login_attempts.find_one_and_update(
        {"email": email}, {"$inc": {"failures": 1}}, upsert=True, return_document=True)
    if doc and doc.get("failures", 0) >= MAX_FAILURES:
        await db.login_attempts.update_one({"email": email}, {"$set": {
            "failures": 0, "locked_until": datetime.now(timezone.utc) + timedelta(minutes=LOCK_MINUTES)}})


async def clear_failures(email: str) -> None:
    await db.login_attempts.delete_one({"email": email})
