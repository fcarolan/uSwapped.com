"""Members report listings that break the rules; admins review them in the admin portal."""
import uuid

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import get_current_user, now_iso
from lib.db import db
from models.schemas import Report, ReportCreate

router = APIRouter()


@router.post("/reports", response_model=Report)
async def create_report(body: ReportCreate, user: dict = Depends(get_current_user)):
    item = await db.items.find_one({"id": body.item_id}, {"_id": 0})
    if not item or item.get("status") == "removed":
        raise HTTPException(status_code=404, detail="Item not found")
    if item["owner_id"] == user["user_id"]:
        raise HTTPException(status_code=400, detail="You can't report your own listing")
    if await db.reports.find_one({"item_id": body.item_id, "reporter_id": user["user_id"], "status": "open"}, {"_id": 1}):
        raise HTTPException(status_code=400, detail="You've already reported this listing. Our team is on it.")
    report = Report(
        id=str(uuid.uuid4()), item_id=item["id"], item_title=item["title"], item_image_url=item["image_url"],
        item_owner_id=item["owner_id"], item_owner_name=item["owner_name"], reporter_id=user["user_id"],
        reporter_name=user["name"], reason=body.reason, details=body.details.strip(), created_at=now_iso(),
    )
    await db.reports.insert_one(report.model_dump())
    return report
