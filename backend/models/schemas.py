"""Pydantic models — mirrored by hand in frontend/src/lib/types.ts. Keep both in sync."""
from typing import List, Literal, Optional
from pydantic import BaseModel, EmailStr, Field, computed_field

from lib.fees import processing_fee_cents

Category = Literal[
    "Electronics", "Fashion", "Books", "Music & Vinyl", "Home & Garden",
    "Toys & Games", "Sports & Outdoors", "Collectibles", "Other",
]
Condition = Literal["New", "Like new", "Good", "Fair"]
ItemStatus = Literal["available", "reserved", "swapped", "removed"]  # reserved = accepted, waiting for the fee
# accepted = fee paid, swap confirmed
SwapStatus = Literal["pending", "awaiting_payment", "accepted", "declined", "cancelled", "expired"]


Role = Literal["user", "admin"]


class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: Role = "user"
    created_at: str


class RegisterBody(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


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
    status: ItemStatus = "available"
    created_at: str
    owner_rating_avg: Optional[float] = None  # filled at read time from the owner's ratings
    owner_rating_count: int = 0

    @computed_field
    @property
    def processing_fee_cents(self) -> int:
        return processing_fee_cents(self.value_eur)


class ItemSummary(BaseModel):
    id: str
    title: str
    image_url: str
    value_eur: float


class UploadResult(BaseModel):
    id: str
    url: str


class AuthProviders(BaseModel):
    google: bool
    facebook: bool


NotificationKind = Literal[
    "swap_offer", "swap_accepted", "swap_declined", "message",
    "swap_posted", "swap_received", "rating", "saved_search", "swap_confirmed",
]


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
    fee_cents: int  # processing fee paid by the proposer (5% of target item value, €0.99–€19.99)
    payment_due_at: Optional[str] = None  # set when the owner accepts; unpaid swaps expire after 48h
    fee_paid: bool = False
    message: str = ""
    status: SwapStatus = "pending"
    created_at: str
    counterpart_email: Optional[str] = None  # revealed only once accepted, to arrange postage
    # postage tracking (accepted swaps). "proposer_received_at" = proposer got the owner's item.
    proposer_posted_at: Optional[str] = None
    proposer_tracking: Optional[str] = None
    owner_posted_at: Optional[str] = None
    owner_tracking: Optional[str] = None
    proposer_received_at: Optional[str] = None
    owner_received_at: Optional[str] = None
    proposer_rated: bool = False
    owner_rated: bool = False
    proposer_label_id: Optional[str] = None
    owner_label_id: Optional[str] = None


class PostedUpdate(BaseModel):
    tracking: str = Field(default="", max_length=80)


class RatingCreate(BaseModel):
    stars: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=300)


class Rating(BaseModel):
    id: str
    swap_id: str
    rater_id: str
    rater_name: str
    rater_picture: Optional[str] = None
    ratee_id: str
    stars: int
    comment: str = ""
    item_title: str
    created_at: str


class UserProfile(BaseModel):
    user_id: str
    name: str
    picture: Optional[str] = None
    member_since: str
    rating_avg: Optional[float] = None
    rating_count: int = 0
    trusted: bool = False
    swaps_completed: int = 0
    ratings: List[Rating]
    items: List[Item]


class SavedSearchCreate(BaseModel):
    q: str = Field(default="", max_length=60)
    category: Optional[Category] = None
    location: str = Field(default="", max_length=60)


class SavedSearch(SavedSearchCreate):
    id: str
    user_id: str
    created_at: str


class SwapLists(BaseModel):
    incoming: List[Swap]
    outgoing: List[Swap]


class SwapFeeCheckout(BaseModel):
    swap_id: str
    origin_url: str


class Address(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    line1: str = Field(min_length=3, max_length=80)
    line2: str = Field(default="", max_length=80)
    city: str = Field(min_length=2, max_length=50)
    postcode: str = Field(default="", max_length=12)
    country: str = Field(default="Ireland", min_length=2, max_length=40)


LabelSizeId = Literal["small", "medium", "large", "xl"]


class LabelSize(BaseModel):
    id: LabelSizeId
    label: str
    description: str
    base_cents: int
    price_cents: int


class LabelCheckout(BaseModel):
    swap_id: str
    size: LabelSizeId
    sender: Address
    recipient: Address
    origin_url: str


class ShippingLabel(BaseModel):
    id: str
    swap_id: str
    user_id: str
    size: LabelSizeId
    price_cents: int
    sender: Address
    recipient: Address
    status: Literal["pending_payment", "paid"]
    carrier: str
    tracking_number: Optional[str] = None
    is_demo: bool = True  # DEMO until a real carrier (Sendcloud/Shippo) is connected
    created_at: str


class CheckoutResponse(BaseModel):
    checkout_url: str
    session_id: str


PaymentKind = Literal["swap_fee", "label"]


class PaymentStatus(BaseModel):
    session_id: str
    status: str
    payment_status: str
    kind: PaymentKind
    swap_id: str
    label_id: Optional[str] = None


class PaymentRecord(BaseModel):
    session_id: str
    kind: PaymentKind
    description: str
    amount_cents: int
    payment_status: str
    created_at: str


# ---------- reports ----------
ReportReason = Literal["prohibited", "scam", "misleading", "offensive", "other"]


class ReportCreate(BaseModel):
    item_id: str
    reason: ReportReason
    details: str = Field(default="", max_length=500)


class Report(BaseModel):
    id: str
    item_id: str
    item_title: str
    item_image_url: str
    item_owner_id: str
    item_owner_name: str
    reporter_id: str
    reporter_name: str
    reason: ReportReason
    details: str = ""
    status: Literal["open", "dismissed", "item_removed"] = "open"
    resolved_by: Optional[str] = None
    resolved_at: Optional[str] = None
    created_at: str


# ---------- admin ----------
class AdminStats(BaseModel):
    users: int
    suspended_users: int
    items_available: int
    items_removed: int
    swaps_by_status: dict
    open_reports: int
    revenue_cents: int
    refunded_cents: int


class AdminUser(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: Role = "user"
    suspended: bool = False
    auth: str  # "password" | "google" | "facebook"
    listings: int = 0
    swaps: int = 0
    rating_avg: Optional[float] = None
    rating_count: int = 0
    created_at: str


class SuspendBody(BaseModel):
    suspended: bool


class RoleBody(BaseModel):
    role: Role


class RemoveItemBody(BaseModel):
    reason: str = Field(default="Breaks USwapped listing rules", max_length=200)


class ReportResolve(BaseModel):
    action: Literal["dismiss", "remove_item"]


class AdminTransaction(BaseModel):
    session_id: str
    user_id: str
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    kind: PaymentKind
    description: str
    amount_cents: int
    payment_status: str
    swap_id: str
    refundable: bool = False
    created_at: str


class AuditEntry(BaseModel):
    id: str
    admin_id: str
    admin_name: str
    action: str
    target: str
    detail: str = ""
    created_at: str


class AdminActionResult(BaseModel):
    ok: bool = True
    detail: str = ""
