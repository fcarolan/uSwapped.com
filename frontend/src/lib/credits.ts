// Mirrors backend/lib/credits.py — the server is the source of truth; this powers the live previews.
import type { CreditPack } from "./types";

export const CREDIT_TIERS = [
  { label: "Under €10", example: "Books, DVDs, small toys", credits: "1" },
  { label: "€10 – €49", example: "Clothing, vinyl, games", credits: "2" },
  { label: "€50 – €99", example: "Sneakers, small appliances", credits: "4" },
  { label: "€100 – €249", example: "Headphones, bikes, guitars", credits: "8" },
  { label: "€250 +", example: "Phones, laptops, consoles", credits: "4% of value (10–50)" },
];

export function creditsForValue(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value < 10) return 1;
  if (value < 50) return 2;
  if (value < 100) return 4;
  if (value < 250) return 8;
  return Math.min(50, Math.max(10, Math.ceil(Number((value * 0.04).toFixed(6)))));
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: "pack_10", credits: 10, amount_cents: 199, label: "Starter", popular: false },
  { id: "pack_20", credits: 20, amount_cents: 399, label: "Swapper", popular: false },
  { id: "pack_50", credits: 50, amount_cents: 699, label: "Pro Swapper", popular: true },
  { id: "pack_100", credits: 100, amount_cents: 999, label: "Swap Legend", popular: false },
];

export const PACK_BLURBS: Record<string, string> = {
  pack_10: "Perfect for books, clothes & small bits",
  pack_20: "A handful of mid-size swaps",
  pack_50: "For regular swappers — best balance",
  pack_100: "Electronics & big-ticket swaps",
};

export const euro = (cents: number) => `€${(cents / 100).toFixed(2)}`;
export const eur = (v: number) =>
  `€${v.toLocaleString("en-IE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
