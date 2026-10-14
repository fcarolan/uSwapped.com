"""Session-cookie auth helper (Emergent Google Auth). Cookie first, Bearer header fallback."""
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, Request

from lib.db import db


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _user_from_request(request: Request) -> Optional[dict]:
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        return None
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        return None
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        return None
    return await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})


async def get_current_user(request: Request) -> dict:
    user = await _user_from_request(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user
