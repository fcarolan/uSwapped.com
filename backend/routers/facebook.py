"""Facebook Login (server-side OAuth code flow). Disabled until FACEBOOK_APP_ID/SECRET are set in .env."""
import hashlib
import hmac
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse

from lib.auth import now_iso
from lib.credits import SIGNUP_BONUS
from lib.db import db
from models.schemas import AuthProviders

router = APIRouter(prefix="/auth")
GRAPH_VERSION = "v24.0"
CALLBACK_PATH = "/api/auth/facebook/callback"


def _cfg():
    return os.environ.get("FACEBOOK_APP_ID", ""), os.environ.get("FACEBOOK_APP_SECRET", "")


def _redirect_uri(request: Request) -> str:
    explicit = os.environ.get("FACEBOOK_REDIRECT_URI")
    if explicit:
        return explicit
    proto = request.headers.get("x-forwarded-proto", request.url.scheme).split(",")[0].strip()
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or request.url.netloc
    return f"{proto}://{host.split(',')[0].strip()}{CALLBACK_PATH}"


@router.get("/providers", response_model=AuthProviders)
async def providers():
    app_id, secret = _cfg()
    return AuthProviders(google=True, facebook=bool(app_id and secret))


@router.get("/facebook/login")
async def facebook_login(request: Request):
    app_id, secret = _cfg()
    if not (app_id and secret):
        return RedirectResponse("/login?error=facebook_unavailable", status_code=302)
    state = secrets.token_urlsafe(32)
    params = {"client_id": app_id, "redirect_uri": _redirect_uri(request), "response_type": "code",
              "state": state, "scope": "email,public_profile"}
    resp = RedirectResponse(f"https://www.facebook.com/{GRAPH_VERSION}/dialog/oauth?{urlencode(params)}", status_code=302)
    resp.set_cookie("facebook_oauth_state", state, max_age=600, httponly=True, secure=True, samesite="lax",
                    path=CALLBACK_PATH)
    return resp


@router.get("/facebook/callback")
async def facebook_callback(request: Request):
    app_id, secret = _cfg()
    fail = lambda reason: RedirectResponse(f"/login?error={reason}", status_code=302)  # noqa: E731
    if request.query_params.get("error") or not (app_id and secret):
        return fail("facebook_denied")
    code, state = request.query_params.get("code"), request.query_params.get("state")
    saved = request.cookies.get("facebook_oauth_state")
    if not code or not state or not saved or not hmac.compare_digest(state, saved):
        return fail("facebook_state")

    graph = f"https://graph.facebook.com/{GRAPH_VERSION}"
    async with httpx.AsyncClient(timeout=10) as http:
        tr = await http.get(f"{graph}/oauth/access_token", params={
            "client_id": app_id, "client_secret": secret, "redirect_uri": _redirect_uri(request), "code": code})
        token = tr.json().get("access_token") if tr.status_code == 200 else None
        if not token:
            return fail("facebook_token")
        proof = hmac.new(secret.encode(), token.encode(), hashlib.sha256).hexdigest()
        pr = await http.get(f"{graph}/me", params={"fields": "id,name,email,picture.type(large)",
                                                   "access_token": token, "appsecret_proof": proof})
        profile = pr.json() if pr.status_code == 200 else {}

    email = (profile.get("email") or "").strip().lower()
    if not profile.get("id") or not email:
        return fail("facebook_email_required")
    picture = ((profile.get("picture") or {}).get("data") or {}).get("url")
    name = profile.get("name") or email.split("@")[0]

    user = await db.users.find_one({"email": email}, {"_id": 0})
    if user:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"facebook_id": profile["id"]}})
        user_id = user["user_id"]
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({"user_id": user_id, "email": email, "name": name, "picture": picture,
                                   "facebook_id": profile["id"], "credits": SIGNUP_BONUS, "created_at": now_iso()})
        await db.credit_transactions.insert_one({"id": str(uuid.uuid4()), "user_id": user_id, "amount": SIGNUP_BONUS,
                                                 "reason": "Welcome bonus", "created_at": now_iso()})

    session_token = secrets.token_urlsafe(32)
    await db.user_sessions.insert_one({"user_id": user_id, "session_token": session_token,
                                       "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
                                       "created_at": now_iso()})
    resp = RedirectResponse("/dashboard", status_code=303)
    resp.delete_cookie("facebook_oauth_state", path=CALLBACK_PATH)
    resp.set_cookie("session_token", session_token, httponly=True, secure=True, samesite="none", path="/",
                    max_age=7 * 24 * 3600)
    return resp
