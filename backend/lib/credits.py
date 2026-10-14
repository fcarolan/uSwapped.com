"""Swap Credit packs and the item-value -> credit cost formula (single source of truth)."""
import math

CREDIT_PACKS = [
    {"id": "pack_10", "credits": 10, "amount_cents": 199, "lookup_key": "uswapped_credits_10", "label": "Starter"},
    {"id": "pack_20", "credits": 20, "amount_cents": 399, "lookup_key": "uswapped_credits_20", "label": "Swapper"},
    {"id": "pack_50", "credits": 50, "amount_cents": 699, "lookup_key": "uswapped_credits_50", "label": "Pro Swapper", "popular": True},
    {"id": "pack_100", "credits": 100, "amount_cents": 999, "lookup_key": "uswapped_credits_100", "label": "Swap Legend"},
]

SIGNUP_BONUS = 3

# (upper bound exclusive in EUR, credits)
CREDIT_TIERS = [
    (10, 1),
    (50, 2),
    (100, 4),
    (250, 8),
]
HIGH_VALUE_RATE = 0.04
MAX_CREDITS = 50


def credits_for_value(value_eur: float) -> int:
    for bound, credits in CREDIT_TIERS:
        if value_eur < bound:
            return credits
    return min(MAX_CREDITS, max(10, math.ceil(round(value_eur * HIGH_VALUE_RATE, 6))))


def pack_by_id(pack_id: str):
    return next((p for p in CREDIT_PACKS if p["id"] == pack_id), None)
