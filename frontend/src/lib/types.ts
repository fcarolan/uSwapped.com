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

export interface ItemCreate {
  title: string;
  description: string;
  category: Category;
  condition: Condition;
  value_eur: number;
  image_url: string;
  location: string;
}

export interface Item extends ItemCreate {
  id: string;
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
