"""Pydantic models — mirrored by hand in frontend/src/lib/types.ts. Keep both in sync."""
from typing import List, Literal, Optional
from pydantic import BaseModel, Field

Category = Literal[
    "Electronics", "Fashion", "Books", "Music & Vinyl", "Home & Garden",
    "Toys & Games", "Sports & Outdoors", "Collectibles", "Other",
]
Condition = Literal["New", "Like new", "Good", "Fair"]
ItemStatus = Literal["available", "swapped"]
SwapStatus = Literal["pending", "accepted", "declined", "cancelled"]


class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    credits: int = 0
    created_at: str


class SessionExchange(BaseModel):
    session_id: str


class MobileSession(BaseModel):
    user: User
    session_token: str


class ItemBase(BaseModel):
    title: str = Field(min_length=2, max_length=80)
    description: str = Field(min_length=5, max_length=1500)
    category: Category
    condition: Condition
    value_eur: float = Field(gt=0, le=100000)
    location: str = Field(min_length=2, max_length=60)


class ItemCreate(ItemBase):
    images: List[str] = Field(min_length=1, max_length=4)  # URLs returned by POST /api/uploads


class Item(ItemBase):
    id: str
    image_url: str  # cover photo (= images[0])
    images: List[str] = []
    owner_id: str
    owner_name: str
    owner_picture: Optional[str] = None
    credit_cost: int
    status: ItemStatus = "available"
    created_at: str


class ItemSummary(BaseModel):
    id: str
    title: str
    image_url: str
    value_eur: float
    credit_cost: int


class UploadResult(BaseModel):
    id: str
    url: str


class AuthProviders(BaseModel):
    google: bool
    facebook: bool


NotificationKind = Literal["swap_offer", "swap_accepted", "swap_declined", "message"]


class Notification(BaseModel):
    id: str
    user_id: str
    kind: NotificationKind
    title: str
    body: str
    link: str
    read: bool = False
    created_at: str


class NotificationList(BaseModel):
    items: List[Notification]
    unread: int


class PushKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscription(BaseModel):
    endpoint: str = Field(min_length=10)
    keys: PushKeys


class PushUnsubscribe(BaseModel):
    endpoint: str


class PushKey(BaseModel):
    public_key: str


class MessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=1000)


class Message(BaseModel):
    id: str
    swap_id: str
    sender_id: str
    sender_name: str
    body: str
    created_at: str


class SwapCreate(BaseModel):
    target_item_id: str
    offered_item_id: str
    message: str = Field(default="", max_length=500)


class Swap(BaseModel):
    id: str
    proposer_id: str
    proposer_name: str
    owner_id: str
    owner_name: str
    target_item: ItemSummary
    offered_item: ItemSummary
    proposer_cost: int  # proposer receives target item
    owner_cost: int  # owner receives offered item
    message: str = ""
    status: SwapStatus = "pending"
    created_at: str
    counterpart_email: Optional[str] = None  # revealed only once accepted, to arrange postage


class SwapLists(BaseModel):
    incoming: List[Swap]
    outgoing: List[Swap]


class CreditPack(BaseModel):
    id: str
    credits: int
    amount_cents: int
    label: str
    popular: bool = False


class CreditTx(BaseModel):
    id: str
    user_id: str
    amount: int
    reason: str
    created_at: str


class CheckoutRequest(BaseModel):
    pack_id: str
    origin_url: str


class CheckoutResponse(BaseModel):
    checkout_url: str
    session_id: str


class PaymentStatus(BaseModel):
    session_id: str
    status: str
    payment_status: str
    credits: int
