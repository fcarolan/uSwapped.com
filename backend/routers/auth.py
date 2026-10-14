import uuid
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from lib.auth import get_current_user, now_iso
from lib.credits import SIGNUP_BONUS
from lib.db import db
from models.schemas import MobileSession, SessionExchange, User

router = APIRouter(prefix="/auth")
SESSION_DATA_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"


async def _exchange(session_id: str) -> tuple[dict, str]:
    async with httpx.AsyncClient(timeout=15) as http:
        r = await http.get(SESSION_DATA_URL, headers={"X-Session-ID": session_id})
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session")
    data = r.json()

    user = await db.users.find_one({"email": data["email"]}, {"_id": 0})
    if user:
        await db.users.update_one({"user_id": user["user_id"]},
                                  {"$set": {"name": data["name"], "picture": data.get("picture")}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id, "email": data["email"], "name": data["name"],
            "picture": data.get("picture"), "credits": SIGNUP_BONUS, "created_at": now_iso(),
        })
        await db.credit_transactions.insert_one({
            "id": str(uuid.uuid4()), "user_id": user_id, "amount": SIGNUP_BONUS,
            "reason": "Welcome bonus", "created_at": now_iso(),
        })
    user = await db.users.find_one({"email": data["email"]}, {"_id": 0})

    await db.user_sessions.insert_one({
        "user_id": user["user_id"], "session_token": data["session_token"],
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7), "created_at": now_iso(),
    })
    return user, data["session_token"]


@router.post("/session", response_model=User)
async def exchange_session(body: SessionExchange, response: Response):
    user, token = await _exchange(body.session_id)
    response.set_cookie("session_token", token, httponly=True, secure=True,
                        samesite="none", path="/", max_age=7 * 24 * 3600)
    return User(**user)


# Native (Expo) clients can't use httpOnly cookies: they store the token in secure storage and send it as
# "Authorization: Bearer <token>". Web clients must keep using /auth/session.
@router.post("/mobile-session", response_model=MobileSession)
async def exchange_mobile_session(body: SessionExchange):
    user, token = await _exchange(body.session_id)
    return MobileSession(user=User(**user), session_token=token)


@router.get("/me", response_model=User)
async def me(user: dict = Depends(get_current_user)):
    return User(**user)


@router.post("/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/", secure=True, samesite="none")
    return {"ok": True}
