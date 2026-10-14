# USwapped.com — SPEC

Peer-to-peer item swapping marketplace. No cash between users; swaps are confirmed with **Swap Credits (REMOVED in v2, see bottom)** (sold via Stripe). Each swapper posts their own item at their own cost.

## Revenue model
- Credits sold in packs (EUR, Stripe Checkout, claimable sandbox, tax mode "Stripe manages everything"): 10=€1.99, 20=€3.99, 50=€6.99, 100=€9.99.
- 3 free credits on sign-up.
- Both swappers pay credits when a swap is ACCEPTED; each pays the credit cost of the item they RECEIVE.

## Credit formula (backend/lib/credits.py, mirrored in frontend/src/lib/credits.ts)
<€10=1, €10–49=2, €50–99=4, €100–249=8, €250+=ceil(4% of value), min 10, max 50.

## Data model (Mongo)
- users {user_id, email, name, picture, credits, created_at}
- user_sessions {user_id, session_token, expires_at}
- images {id, owner_id, content_type, data(Binary), size}
- items {id, owner_id, owner_name, owner_picture, title, description, category, condition, value_eur, image_url (cover = images[0]), images[], location, credit_cost, status available|swapped, created_at}
- swaps {id, proposer_id, owner_id, target_item{summary}, offered_item{summary}, proposer_cost, owner_cost, message, status pending|accepted|declined|cancelled}
- credit_transactions {id, user_id, amount(+/-), reason, created_at}
- payment_transactions {session_id, user_id, pack_id, credits, amount, status, payment_status, credited}

## API (/api)
auth: POST /auth/session (web, sets cookie), POST /auth/mobile-session (native: returns {user, session_token}), GET /auth/me, POST /auth/logout, GET /auth/providers {google, facebook}, GET /auth/facebook/login → Facebook → GET /auth/facebook/callback (sets cookie, redirects /dashboard)
items: GET /items?q=&category=, GET /items/mine, GET /items/{id}, POST /items (images: 1–4 URLs from /uploads, must be owned by caller), DELETE /items/{id}
uploads: POST /uploads (multipart `file`, jpeg/png/webp ≤3MB, auth) → {id,url:/api/images/{id}}; GET /images/{id} (public bytes)
swaps: GET /swaps, POST /swaps, GET /swaps/{id} (parties only), POST /swaps/{id}/accept|decline|cancel, GET|POST /swaps/{id}/messages (parties only; POST only when accepted)
notifications: GET /notifications {items, unread}, POST /notifications/read-all, POST /notifications/{id}/read
push: GET /push/public-key, POST /push/subscribe {endpoint, keys{p256dh,auth}}, POST /push/unsubscribe {endpoint}
credits: GET /credits/packs, GET /credits/history, POST /payments/checkout {pack_id, origin_url}, GET /payments/status/{session_id}, POST /stripe/webhook

## Flows
- Login: Emergent Google Auth → /dashboard#session_id=… → AuthCallback → httpOnly cookie. Facebook button = disabled "coming soon". Shopify not integrated (later).
- Propose: item detail → "Propose a swap" dialog → pick own available item → send (requires credits ≥ target cost, nothing deducted).
- Accept (owner, dashboard Offers tab): deducts both parties' credits, marks both items swapped, cancels other pending offers on those items, reveals counterpart email.
- Buy credits: /credits → Stripe checkout → /payment/success polls status → credits granted once.

## Seed (python backend/seed.py, idempotent)
- Demo owners: user_demo_aoife, user_demo_luca, user_demo_sophie (50 credits each, no sessions). 10 listings (ids seed-camera, seed-typewriter, seed-sneakers, seed-headphones, seed-guitar, seed-vinyl, seed-console, seed-books, seed-bike, seed-jacket).
- Test user user_test_swapper (50 credits) owns seed-test-lamp (€40 → 2 credits). See test_credentials.md.

## Photos
Create Listing uses PhotoUploader: pick/take up to 4 photos, resized client-side to max 1200px JPEG, uploaded to /api/uploads, first = cover. Item detail shows a thumbnail gallery. Seed items have only image_url (images=[]).

## Mobile app (PWA)
manifest.webmanifest + sw.js (offline fallback only, never caches /api) + icons (icon-192/512, apple-touch-icon). Mobile (<md): bottom tab bar (Home, Browse, List, Credits, Me) + dismissible install prompt (Android: native install button via beforeinstallprompt; iOS: "Share → Add to Home Screen" hint). Native App Store/Play app not built.

## Chat + notifications
- Chat page /swaps/:id/chat (accepted swaps only, both parties; polls every 4s; quick replies). "Chat" button on accepted swaps in dashboard.
- Notifications created on: new offer (→ owner), accepted (→ proposer, links to chat), declined (→ proposer), new message (→ other party). Bell in header polls every 20s, popover list, mark read, "Turn on phone alerts".
- Web Push via VAPID (pywebpush; keys VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY in backend/.env). Service worker shows the notification and opens the link on tap. iPhone requires iOS 16.4+ and the app added to Home Screen.

## Facebook login
Code is ready but DISABLED until FACEBOOK_APP_ID and FACEBOOK_APP_SECRET are set in backend/.env (then restart backend). Redirect URI to register in Meta: https://<public-host>/api/auth/facebook/callback (override with FACEBOOK_REDIRECT_URI). Login button reads /auth/providers.

## Postage tracking, ratings, trusted swappers
- Accepted swaps carry proposer_/owner_ posted_at, tracking, received_at, rated. "proposer_received_at" = proposer received the owner's item.
- POST /swaps/{id}/posted {tracking?} (re-call edits tracking), POST /swaps/{id}/received, POST /swaps/{id}/rating {stars 1-5, comment} (only after *you* marked received, once per side). Each notifies the other party (swap_posted / swap_received / rating).
- Ratings stored in `ratings`; users keep rating_sum/rating_count. Items are enriched with owner_rating_avg/owner_rating_count at read time.
- Trusted swapper = ≥3 ratings and avg ≥4.5 (backend lib/search.py is_trusted, mirrored in components/Trust.tsx). Seed: Aoife 4.8 (4) trusted, Sophie 5.0 (3) trusted, Luca 4.5 (2) not trusted.
- Public profile: GET /users/{user_id} → page /users/:id (rating, reviews, listings, swaps received). Linked from item detail owner card.
- SwapProgress tracker shows on accepted swaps in Dashboard and Chat.

## Saved searches
- GET/POST/DELETE /saved-searches {q, category?, location} (max 10/user, no duplicates, at least one field). Browse has a location box + "Save search & get alerts"; Dashboard "Saved searches" tab.
- Search matching (Browse + alerts) is word-based and plural-tolerant ("cameras" matches "Camera"); location is a case-insensitive contains. New listings trigger a `saved_search` notification (+ push) to each other user with a matching search.


## BUSINESS MODEL v2 (replaces Swap Credits — credits fully removed)
- Listing and offering are FREE. Only the person requesting a swap (proposer) pays a processing fee: 5% of the target item's estimated value, min €0.99, max €19.99 (backend lib/fees.py, mirrored in frontend lib/fees.ts). Item responses include computed `processing_fee_cents`; swaps store `fee_cents`.
- Swap flow: pending → owner accepts → `awaiting_payment` (both items `reserved`, payment_due_at = +48h) → proposer pays via Stripe (POST /payments/swap-fee {swap_id, origin_url}) → `accepted` (= confirmed; items `swapped`, other offers on those items cancelled, both notified `swap_confirmed`, chat + postage tracker open, emails revealed). Unpaid after 48h → `expired` (lazy, items back to available). Proposer can cancel while pending/awaiting_payment.
- Shipping labels (optional, sender pays): sizes small €5.00 / medium €8.00 / large €12.00 / xl €16.50 (base + €0.50 margin). POST /payments/label {swap_id, size, sender, recipient, origin_url} (confirmed swaps, one per side) → Stripe → label `paid`, tracking `DEMO-USW-XXXXXXXX` copied to swap {role}_tracking + {role}_label_id. GET /labels/{id}/pdf (owner only) = A6 PDF. **LABELS + TRACKING ARE MOCKED/DEMO** (lib/labels.py) until a carrier (Sendcloud/Shippo) is connected.
- Payments: payment_transactions {session_id, user_id, kind swap_fee|label, swap_id, label_id, description, amount_cents, payment_status, fulfilled}. GET /payments/status/{session_id}, GET /payments/history, POST /stripe/webhook. Stripe products (setup_stripe.py): uswapped_processing_fee, uswapped_shipping_label, inline price_data. Old credit packs retired.
- Pages: /pricing (fees + label prices; /credits aliases it). Dashboard tabs: Offers for me, My offers (Pay fee button + countdown), My listings, Saved searches, Payments.

## Email + password auth (added alongside Google/Facebook)
- POST /auth/register {name, email, password ≥8} → bcrypt hash, sets session cookie, email_verified=false. 409 if the email exists.
- POST /auth/login {email, password} → 401 wrong creds, 403 suspended, 429 after 5 failures for 15 min (login_attempts).
- If an unverified password account later signs in with Google/Facebook (email proven), the unverified password is dropped (stops account takeover).
- Suspended users: sessions deleted and _user_from_request returns None (signed out everywhere); open swaps cancelled.
- User has role "user"|"admin". password_hash is never returned.

## Admin portal (/admin, role=admin only; API /api/admin/* uses require_admin → 401/403)
- Tabs: Overview (stats), Reports (dismiss / remove listing), Listings (search/filter, remove with reason → owner notified, restore), Users (suspend/unsuspend, make/revoke admin, remove all listings, permanent delete with "DELETE" prompt; can't act on yourself), Swaps (filter, cancel open swaps), Transactions (Stripe refunds for real paid payments), Audit log (every admin write, admin_audit).
- Item status "removed" = hidden from Browse and 404 on /items/{id}; removing cancels open swaps and frees reserved items.
- Reports: POST /reports {item_id, reason prohibited|scam|misleading|offensive|other, details} — signed-in non-owners, one open report per item per user. "Report this listing" on item detail.
- First admin seeded by seed.py from ADMIN_EMAIL / ADMIN_PASSWORD in backend/.env.
