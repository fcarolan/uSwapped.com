"""Idempotent Stripe catalog setup for USwapped. Run: python setup_stripe.py
Products only: amounts are dynamic (processing fee = 5% of item value; label price by size) and are sent
as inline price_data at checkout. Retires the old Swap Credit packs."""
import os
import stripe
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / ".env")
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"

PRODUCTS = [
    {"emergent_product_id": "uswapped_processing_fee", "name": "USwapped swap processing fee", "tax_code": "txcd_10000000"},
    {"emergent_product_id": "uswapped_shipping_label", "name": "USwapped shipping label", "tax_code": "txcd_10000000"},
]
RETIRED_LOOKUP_KEYS = ["uswapped_credits_10", "uswapped_credits_20", "uswapped_credits_50", "uswapped_credits_100"]


def main():
    existing = {p.to_dict().get("metadata", {}).get("emergent_product_id"): p
                for p in stripe.Product.list(active=True, limit=100).auto_paging_iter()}
    for entry in PRODUCTS:
        if entry["emergent_product_id"] not in existing:
            stripe.Product.create(name=entry["name"], tax_code=entry["tax_code"],
                                  metadata={"managed_by": "emergent", "emergent_product_id": entry["emergent_product_id"]})
        print("ok", entry["emergent_product_id"])
    # retire credit packs
    for price in stripe.Price.list(lookup_keys=RETIRED_LOOKUP_KEYS, active=True, limit=10).data:
        stripe.Price.modify(price.id, active=False)
        stripe.Product.modify(price.product, active=False)
        print("retired", price.lookup_key)


if __name__ == "__main__":
    main()
