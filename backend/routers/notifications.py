import os
from fastapi import APIRouter, Depends, HTTPException

from lib.auth import get_current_user, now_iso
from lib.db import db
from models.schemas import Notification, NotificationList, PushKey, PushSubscription, PushUnsubscribe

router = APIRouter()


@router.get("/notifications", response_model=NotificationList)
async def list_notifications(user: dict = Depends(get_current_user)):
    docs = await db.notifications.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    unread = await db.notifications.count_documents({"user_id": user["user_id"], "read": False})
    return NotificationList(items=[Notification(**d) for d in docs], unread=unread)


@router.post("/notifications/read-all")
async def read_all(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["user_id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}


@router.post("/notifications/{id}/read")
async def read_one(id: str, user: dict = Depends(get_current_user)):
    r = await db.notifications.update_one({"id": id, "user_id": user["user_id"]}, {"$set": {"read": True}})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}


@router.get("/push/public-key", response_model=PushKey)
async def public_key():
    return PushKey(public_key=os.environ.get("VAPID_PUBLIC_KEY", ""))


@router.post("/push/subscribe")
async def subscribe(body: PushSubscription, user: dict = Depends(get_current_user)):
    await db.push_subscriptions.update_one(
        {"endpoint": body.endpoint},
        {"$set": {"user_id": user["user_id"], "endpoint": body.endpoint, "keys": body.keys.model_dump(),
                  "created_at": now_iso()}},
        upsert=True,
    )
    return {"ok": True}


@router.post("/push/unsubscribe")
async def unsubscribe(body: PushUnsubscribe, user: dict = Depends(get_current_user)):
    await db.push_subscriptions.delete_one({"endpoint": body.endpoint, "user_id": user["user_id"]})
    return {"ok": True}

