import uuid
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from lib.auth import create_session, get_current_user, now_iso
from lib.passwords import clear_failures, hash_password, locked_until, record_failure, verify_password
from lib.db import db
from models.schemas import LoginBody, MobileSession, RegisterBody, SessionExchange, User

router = APIRouter(prefix="/auth")
SESSION_DATA_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"


async def _exchange(session_id: str) -> tuple[dict, str]:
    async with httpx.AsyncClient(timeout=15) as http:
        r = await http.get(SESSION_DATA_URL, headers={"X-Session-ID": session_id})
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session")
    data = r.json()

    user = await db.users.find_one({"email": data["email"]}, {"_id": 0})
    if user and user.get("suspended"):
        raise HTTPException(status_code=403, detail="This account has been suspended. Contact support@uswapped.com.")
    if user:
        update: dict = {"$set": {"name": data["name"], "picture": data.get("picture"), "email_verified": True}}
        if user.get("password_hash") and not user.get("email_verified"):
            # Google proved ownership of this email: drop any password set by an unverified sign-up
            update["$unset"] = {"password_hash": ""}
        await db.users.update_one({"user_id": user["user_id"]}, update)
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id, "email": data["email"], "name": data["name"],
            "picture": data.get("picture"), "role": "user", "email_verified": True, "created_at": now_iso(),
        })
    user = await db.users.find_one({"email": data["email"]}, {"_id": 0, "password_hash": 0})

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


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie("session_token", token, httponly=True, secure=True, samesite="none", path="/",
                        max_age=7 * 24 * 3600)


@router.post("/register", response_model=User)
async def register(body: RegisterBody, response: Response):
    email = body.email.strip().lower()
    if await db.users.find_one({"email": email}, {"_id": 1}):
        raise HTTPException(status_code=409, detail="An account with this email already exists. Try signing in.")
    user = {"user_id": f"user_{uuid.uuid4().hex[:12]}", "email": email, "name": body.name.strip(), "picture": None,
            "role": "user", "password_hash": hash_password(body.password), "email_verified": False,
            "created_at": now_iso()}
    await db.users.insert_one(dict(user))
    _set_session_cookie(response, await create_session(user["user_id"]))
    return User(**user)


@router.post("/login", response_model=User)
async def login(body: LoginBody, response: Response):
    email = body.email.strip().lower()
    if await locked_until(email):
        raise HTTPException(status_code=429, detail="Too many attempts. Please wait 15 minutes and try again.")
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not user.get("password_hash") or not verify_password(body.password, user["password_hash"]):
        await record_failure(email)
        if user and not user.get("password_hash"):
            raise HTTPException(status_code=401, detail="This account uses Google or Facebook sign-in.")
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if user.get("suspended"):
        raise HTTPException(status_code=403, detail="This account has been suspended. Contact support@uswapped.com.")
    await clear_failures(email)
    _set_session_cookie(response, await create_session(user["user_id"]))
    return User(**user)


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
