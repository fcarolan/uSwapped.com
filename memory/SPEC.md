# USwapped.com — SPEC

Peer-to-peer item swapping marketplace. No cash between users; swaps are confirmed with **Swap Credits** (sold via Stripe). Each swapper posts their own item at their own cost.

## Revenue model
- Credits sold in packs (EUR, Stripe Checkout, claimable sandbox, tax mode "Stripe manages everything"): 10=€1.99, 20=€3.99, 50=€6.99, 100=€9.99.
- 3 free credits on sign-up.
- Both swappers pay credits when a swap is ACCEPTED; each pays the credit cost of the item they RECEIVE.

## Credit formula (backend/lib/credits.py, mirrored in frontend/src/lib/credits.ts)
<€10=1, €10–49=2, €50–99=4, €100–249=8, €250+=ceil(4% of value), min 10, max 50.

## Data model (Mongo)
- users {user_id, email, name, picture, credits, created_at}
- user_sessions {user_id, session_token, expires_at}
- items {id, owner_id, owner_name, owner_picture, title, description, category, condition, value_eur, image_url, location, credit_cost, status available|swapped, created_at}
- swaps {id, proposer_id, owner_id, target_item{summary}, offered_item{summary}, proposer_cost, owner_cost, message, status pending|accepted|declined|cancelled}
- credit_transactions {id, user_id, amount(+/-), reason, created_at}
- payment_transactions {session_id, user_id, pack_id, credits, amount, status, payment_status, credited}

## API (/api)
auth: POST /auth/session, GET /auth/me, POST /auth/logout
items: GET /items?q=&category=, GET /items/mine, GET /items/{id}, POST /items, DELETE /items/{id}
swaps: GET /swaps, POST /swaps, POST /swaps/{id}/accept|decline|cancel
credits: GET /credits/packs, GET /credits/history, POST /payments/checkout {pack_id, origin_url}, GET /payments/status/{session_id}, POST /stripe/webhook

## Flows
- Login: Emergent Google Auth → /dashboard#session_id=… → AuthCallback → httpOnly cookie. Facebook button = disabled "coming soon". Shopify not integrated (later).
- Propose: item detail → "Propose a swap" dialog → pick own available item → send (requires credits ≥ target cost, nothing deducted).
- Accept (owner, dashboard Offers tab): deducts both parties' credits, marks both items swapped, cancels other pending offers on those items, reveals counterpart email.
- Buy credits: /credits → Stripe checkout → /payment/success polls status → credits granted once.

## Seed (python backend/seed.py, idempotent)
- Demo owners: user_demo_aoife, user_demo_luca, user_demo_sophie (50 credits each, no sessions). 10 listings (ids seed-camera, seed-typewriter, seed-sneakers, seed-headphones, seed-guitar, seed-vinyl, seed-console, seed-books, seed-bike, seed-jacket).
- Test user user_test_swapper (50 credits) owns seed-test-lamp (€40 → 2 credits). See test_credentials.md.
