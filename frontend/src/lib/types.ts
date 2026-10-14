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

export type ItemStatus = "available" | "swapped";
export type SwapStatus = "pending" | "accepted" | "declined" | "cancelled";

export interface User {
  user_id: string;
  email: string;
  name: string;
  picture: string | null;
  credits: number;
  created_at: string;
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
  id: string;
  image_url: string; // cover = images[0]
  images: string[];
  owner_id: string;
  owner_name: string;
  owner_picture: string | null;
  credit_cost: number;
  status: ItemStatus;
  created_at: string;
}

export interface ItemSummary {
  id: string;
  title: string;
  image_url: string;
  value_eur: number;
  credit_cost: number;
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
  proposer_cost: number;
  owner_cost: number;
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

export interface CreditPack {
  id: string;
  credits: number;
  amount_cents: number;
  label: string;
  popular: boolean;
}

export interface CreditTx {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  created_at: string;
}

export interface UploadResult {
  id: string;
  url: string;
}

export interface CheckoutResponse {
  checkout_url: string;
  session_id: string;
}

export interface PaymentStatus {
  session_id: string;
  status: string;
  payment_status: string;
  credits: number;
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
  | "saved_search";

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
