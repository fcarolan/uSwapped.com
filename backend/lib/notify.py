"""In-app notifications + Web Push delivery."""
import asyncio
import json
import logging
import os
import uuid

from pywebpush import WebPushException, webpush

from lib.auth import now_iso
from lib.db import db

logger = logging.getLogger(__name__)


def _send_push(sub: dict, payload: str) -> int | None:
    """Returns an HTTP status if the subscription is gone (404/410), else None."""
    try:
        webpush(
            subscription_info={"endpoint": sub["endpoint"], "keys": sub["keys"]},
            data=payload,
            vapid_private_key=os.environ["VAPID_PRIVATE_KEY"],
            vapid_claims={"sub": os.environ.get("VAPID_SUBJECT", "mailto:hello@uswapped.com")},
            ttl=86400,
        )
    except WebPushException as e:
        status = e.response.status_code if e.response is not None else None
        if status in (404, 410):
            return status
        logger.warning("push failed: %s", e)
    except Exception as e:  # never let a push failure break the request
        logger.warning("push error: %s", e)
    return None


async def _push_all(user_id: str, payload: str):
    subs = await db.push_subscriptions.find({"user_id": user_id}, {"_id": 0}).to_list(20)
    for sub in subs:
        gone = await asyncio.to_thread(_send_push, sub, payload)
        if gone:
            await db.push_subscriptions.delete_one({"endpoint": sub["endpoint"]})


async def notify(user_id: str, kind: str, title: str, body: str, link: str):
    doc = {"id": str(uuid.uuid4()), "user_id": user_id, "kind": kind, "title": title, "body": body,
           "link": link, "read": False, "created_at": now_iso()}
    await db.notifications.insert_one(doc)
    payload = json.dumps({"title": title, "body": body, "link": link, "tag": kind})
    asyncio.create_task(_push_all(user_id, payload))  # fire-and-forget so the API stays fast
