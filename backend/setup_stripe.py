"""Idempotent Stripe catalog setup for USwapped credit packs. Run: python setup_stripe.py"""
import os
import stripe
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / ".env")
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"

from lib.credits import CREDIT_PACKS  # noqa: E402

CATALOG = [
    {
        "emergent_product_id": f"uswapped_{p['id']}",
        "name": f"USwapped {p['credits']} Swap Credits",
        "tax_code": "txcd_10000000",
        "prices": [{"lookup_key": p["lookup_key"], "amount": p["amount_cents"], "currency": "eur"}],
    }
    for p in CREDIT_PACKS
]


def get_or_create_product(entry):
    for p in stripe.Product.list(active=True).auto_paging_iter():
        if p.to_dict().get("metadata", {}).get("emergent_product_id") == entry["emergent_product_id"]:
            return p
    return stripe.Product.create(
        name=entry["name"], tax_code=entry["tax_code"],
        metadata={"managed_by": "emergent", "emergent_product_id": entry["emergent_product_id"]},
    )


def main():
    for entry in CATALOG:
        product = get_or_create_product(entry)
        for p in entry["prices"]:
            existing = stripe.Price.list(lookup_keys=[p["lookup_key"]], active=True, limit=1).data
            if existing and (existing[0].unit_amount != p["amount"] or existing[0].currency != p["currency"]):
                stripe.Price.modify(existing[0].id, active=False)
                existing = []
            if not existing:
                stripe.Price.create(product=product.id, unit_amount=p["amount"], currency=p["currency"],
                                    lookup_key=p["lookup_key"], transfer_lookup_key=True)
            print("ok", p["lookup_key"])


if __name__ == "__main__":
    main()
