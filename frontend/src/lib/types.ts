// Hand-written mirrors of backend/models/schemas.py — keep in sync.
export const CATEGORIES = [
  "Electronics",
  "Fashion",
  "Books",
  "Music & Vinyl",
  "Home & Garden",
  "Toys & Games",
  "Sports & Outdoors",
  "Collectibles",
  "Other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CONDITIONS = ["New", "Like new", "Good", "Fair"] as const;
export type Condition = (typeof CONDITIONS)[number];

export type ItemStatus = "available" | "reserved" | "swapped" | "removed"; // reserved = accepted, waiting for the fee
// accepted = fee paid, swap confirmed
export type SwapStatus = "pending" | "awaiting_payment" | "accepted" | "declined" | "cancelled" | "expired";

export interface User {
  user_id: string;
  email: string;
  name: string;
  picture: string | null;
  role: Role;
  created_at: string;
}

export type Role = "user" | "admin";

export interface RegisterBody {
  name: string;
  email: string;
  password: string;
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface ItemBase {
  title: string;
  description: string;
  category: Category;
  condition: Condition;
  value_eur: number;
  location: string;
}

export interface ItemCreate extends ItemBase {
  images: string[]; // URLs from POST /api/uploads
}

export interface Item extends ItemBase {
  owner_rating_avg: number | null; // filled server-side from the owner's ratings
  owner_rating_count: number;
  processing_fee_cents: number; // computed server-side: 5% of value, €0.99–€19.99
  id: string;
  image_url: string; // cover = images[0]
  images: string[];
  owner_id: string;
  owner_name: string;
  owner_picture: string | null;
  status: ItemStatus;
  created_at: string;
}

export interface ItemSummary {
  id: string;
  title: string;
  image_url: string;
  value_eur: number;
}

export interface SwapCreate {
  target_item_id: string;
  offered_item_id: string;
  message: string;
}

export interface Swap {
  id: string;
  proposer_id: string;
  proposer_name: string;
  owner_id: string;
  owner_name: string;
  target_item: ItemSummary;
  offered_item: ItemSummary;
  fee_cents: number; // processing fee paid by the proposer
  payment_due_at: string | null; // set on acceptance; unpaid swaps expire after 48h
  fee_paid: boolean;
  message: string;
  status: SwapStatus;
  created_at: string;
  counterpart_email: string | null;
  // postage tracking — proposer_received_at = proposer got the owner's item
  proposer_posted_at: string | null;
  proposer_tracking: string | null;
  owner_posted_at: string | null;
  owner_tracking: string | null;
  proposer_received_at: string | null;
  owner_received_at: string | null;
  proposer_rated: boolean;
  owner_rated: boolean;
  proposer_label_id: string | null;
  owner_label_id: string | null;
}

export interface PostedUpdate {
  tracking: string;
}

export interface RatingCreate {
  stars: number;
  comment: string;
}

export interface Rating {
  id: string;
  swap_id: string;
  rater_id: string;
  rater_name: string;
  rater_picture: string | null;
  ratee_id: string;
  stars: number;
  comment: string;
  item_title: string;
  created_at: string;
}

export interface UserProfile {
  user_id: string;
  name: string;
  picture: string | null;
  member_since: string;
  rating_avg: number | null;
  rating_count: number;
  trusted: boolean;
  swaps_completed: number;
  ratings: Rating[];
  items: Item[];
}

export interface SavedSearchCreate {
  q: string;
  category: Category | null;
  location: string;
}

export interface SavedSearch extends SavedSearchCreate {
  id: string;
  user_id: string;
  created_at: string;
}

export interface SwapLists {
  incoming: Swap[];
  outgoing: Swap[];
}

export interface UploadResult {
  id: string;
  url: string;
}

export interface CheckoutResponse {
  checkout_url: string;
  session_id: string;
}

export type PaymentKind = "swap_fee" | "label";

export interface PaymentStatus {
  session_id: string;
  status: string;
  payment_status: string;
  kind: PaymentKind;
  swap_id: string;
  label_id: string | null;
}

export interface PaymentRecord {
  session_id: string;
  kind: PaymentKind;
  description: string;
  amount_cents: number;
  payment_status: string;
  created_at: string;
}

export interface SwapFeeCheckout {
  swap_id: string;
  origin_url: string;
}

export interface Address {
  name: string;
  line1: string;
  line2: string;
  city: string;
  postcode: string;
  country: string;
}

export type LabelSizeId = "small" | "medium" | "large" | "xl";

export interface LabelSize {
  id: LabelSizeId;
  label: string;
  description: string;
  base_cents: number;
  price_cents: number;
}

export interface LabelCheckout {
  swap_id: string;
  size: LabelSizeId;
  sender: Address;
  recipient: Address;
  origin_url: string;
}

export interface ShippingLabel {
  id: string;
  swap_id: string;
  user_id: string;
  size: LabelSizeId;
  price_cents: number;
  sender: Address;
  recipient: Address;
  status: "pending_payment" | "paid";
  carrier: string;
  tracking_number: string | null;
  is_demo: boolean; // DEMO until a real carrier is connected
  created_at: string;
}

export interface AuthProviders {
  google: boolean;
  facebook: boolean;
}

export type NotificationKind =
  | "swap_offer"
  | "swap_accepted"
  | "swap_declined"
  | "message"
  | "swap_posted"
  | "swap_received"
  | "rating"
  | "saved_search"
  | "swap_confirmed";

export interface Notification {
  id: string;
  user_id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  link: string;
  read: boolean;
  created_at: string;
}

export interface NotificationList {
  items: Notification[];
  unread: number;
}

export interface PushKey {
  public_key: string;
}

export interface MessageCreate {
  body: string;
}

export interface Message {
  id: string;
  swap_id: string;
  sender_id: string;
  sender_name: string;
  body: string;
  created_at: string;
}

// Used only by native (Expo) clients via POST /api/auth/mobile-session.
export interface MobileSession {
  user: User;
  session_token: string;
}

// ---------- reports ----------
export type ReportReason = "prohibited" | "scam" | "misleading" | "offensive" | "other";

export interface ReportCreate {
  item_id: string;
  reason: ReportReason;
  details: string;
}

export interface Report {
  id: string;
  item_id: string;
  item_title: string;
  item_image_url: string;
  item_owner_id: string;
  item_owner_name: string;
  reporter_id: string;
  reporter_name: string;
  reason: ReportReason;
  details: string;
  status: "open" | "dismissed" | "item_removed";
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

// ---------- admin ----------
export interface AdminStats {
  users: number;
  suspended_users: number;
  items_available: number;
  items_removed: number;
  swaps_by_status: Record<string, number>;
  open_reports: number;
  revenue_cents: number;
  refunded_cents: number;
}

export interface AdminUser {
  user_id: string;
  email: string;
  name: string;
  picture: string | null;
  role: Role;
  suspended: boolean;
  auth: "password" | "google" | "facebook";
  listings: number;
  swaps: number;
  rating_avg: number | null;
  rating_count: number;
  created_at: string;
}

export interface SuspendBody {
  suspended: boolean;
}

export interface RoleBody {
  role: Role;
}

export interface RemoveItemBody {
  reason: string;
}

export interface ReportResolve {
  action: "dismiss" | "remove_item";
}

export interface AdminTransaction {
  session_id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  kind: PaymentKind;
  description: string;
  amount_cents: number;
  payment_status: string;
  swap_id: string;
  refundable: boolean;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  admin_id: string;
  admin_name: string;
  action: string;
  target: string;
  detail: string;
  created_at: string;
}

export interface AdminActionResult {
  ok: boolean;
  detail: string;
}
