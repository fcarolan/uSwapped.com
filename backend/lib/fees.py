"""Processing fee + shipping label pricing (single source of truth; mirrored in frontend/src/lib/fees.ts)."""
import math

FEE_RATE = 0.05          # 5% of the estimated value of the item the requester receives
FEE_MIN_CENTS = 99       # €0.99
FEE_MAX_CENTS = 1999     # €19.99
PAYMENT_WINDOW_HOURS = 48

LABEL_MARGIN_CENTS = 50  # USwapped margin per label
LABEL_SIZES = [
    {"id": "small", "label": "Small parcel", "description": "Up to 2kg · books, clothes, games", "base_cents": 450},
    {"id": "medium", "label": "Medium parcel", "description": "Up to 5kg · shoes, small electronics", "base_cents": 750},
    {"id": "large", "label": "Large parcel", "description": "Up to 10kg · guitars, appliances", "base_cents": 1150},
    {"id": "xl", "label": "Extra large", "description": "Up to 20kg · boxed bikes, bulky items", "base_cents": 1600},
]


def processing_fee_cents(value_eur: float) -> int:
    cents = math.floor(value_eur * FEE_RATE * 100 + 0.5)  # half-up, same as JS Math.round
    return min(FEE_MAX_CENTS, max(FEE_MIN_CENTS, cents))


def label_size(size_id: str):
    s = next((x for x in LABEL_SIZES if x["id"] == size_id), None)
    return {**s, "price_cents": s["base_cents"] + LABEL_MARGIN_CENTS} if s else None
