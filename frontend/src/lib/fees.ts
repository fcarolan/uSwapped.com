// Mirrors backend/lib/fees.py — the server is the source of truth; this powers live previews.
import type { LabelSize } from "./types";

export const FEE_RATE = 0.05;
export const FEE_MIN_CENTS = 99;
export const FEE_MAX_CENTS = 1999;
export const PAYMENT_WINDOW_HOURS = 48;
export const LABEL_MARGIN_CENTS = 50;

export function processingFeeCents(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(FEE_MAX_CENTS, Math.max(FEE_MIN_CENTS, Math.round(value * FEE_RATE * 100)));
}

export const FEE_EXAMPLES = [
  { item: "Paperback", value: 10, note: "minimum" },
  { item: "Vinyl records", value: 45, note: "5%" },
  { item: "Sneakers", value: 90, note: "5%" },
  { item: "Vintage camera", value: 140, note: "5%" },
  { item: "Headphones", value: 220, note: "5%" },
  { item: "Laptop", value: 600, note: "capped" },
];

export const LABEL_SIZES: LabelSize[] = [
  { id: "small", label: "Small parcel", description: "Up to 2kg · books, clothes, games", base_cents: 450, price_cents: 500 },
  { id: "medium", label: "Medium parcel", description: "Up to 5kg · shoes, small electronics", base_cents: 750, price_cents: 800 },
  { id: "large", label: "Large parcel", description: "Up to 10kg · guitars, appliances", base_cents: 1150, price_cents: 1200 },
  { id: "xl", label: "Extra large", description: "Up to 20kg · boxed bikes, bulky items", base_cents: 1600, price_cents: 1650 },
];

export const euro = (cents: number) => `€${(cents / 100).toFixed(2)}`;
export const eur = (v: number) =>
  `€${v.toLocaleString("en-IE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
