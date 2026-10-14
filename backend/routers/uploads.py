"""Photo uploads stored in Mongo (images are resized client-side to ~1200px before upload)."""
import uuid

from bson import Binary
from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile

from lib.auth import get_current_user, now_iso
from lib.db import db
from models.schemas import UploadResult

router = APIRouter()
ALLOWED = {"image/jpeg", "image/png", "image/webp"}
MAX_BYTES = 3 * 1024 * 1024


@router.post("/uploads", response_model=UploadResult)
async def upload_image(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    if file.content_type not in ALLOWED:
        raise HTTPException(status_code=415, detail="Only JPEG, PNG or WebP photos are allowed")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Photo is too large (max 3 MB)")
    image_id = uuid.uuid4().hex
    await db.images.insert_one({
        "id": image_id, "owner_id": user["user_id"], "content_type": file.content_type,
        "data": Binary(data), "size": len(data), "created_at": now_iso(),
    })
    return UploadResult(id=image_id, url=f"/api/images/{image_id}")


@router.get("/images/{id}")
async def get_image(id: str):
    doc = await db.images.find_one({"id": id}, {"_id": 0, "data": 1, "content_type": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Image not found")
    return Response(content=bytes(doc["data"]), media_type=doc["content_type"],
                    headers={"Cache-Control": "public, max-age=31536000, immutable"})
