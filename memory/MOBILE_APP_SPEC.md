# USwapped native app (iOS + Android) — hand-off spec for a new Emergent mobile (Expo) project

Paste this file into the new mobile project. The app must reuse the existing USwapped backend — no new backend.

## Backend
- Base URL: `https://swap-nest.preview.emergentagent.com/api` (swap for the production domain after deploying).
- Auth: native clients send `Authorization: Bearer <session_token>` on every request (backend accepts cookie OR Bearer).
- Login (Google via Emergent Auth): open `https://auth.emergentagent.com/?redirect=<app deep link or web callback>` in an auth session browser, read `session_id` from the returned URL fragment, then `POST /auth/mobile-session {session_id}` → `{user, session_token}`. Store the token in SecureStore. Logout: `POST /auth/logout` with the Bearer header, then delete the token.
- Facebook: available once the web app has Facebook keys (`GET /auth/providers`).

## Screens (mirror the web app)
1. Onboarding / Login — Google button (+ Facebook when `providers.facebook`), "3 free credits" message.
2. Home — hero, credit calculator, latest items (`GET /items`).
3. Browse — search + category chips (`GET /items?q=&category=`), 2-column item grid.
4. Item detail — gallery (`images[]`, else `image_url`), value, credit cost, owner, "Propose a swap" sheet (`GET /items/mine`, `POST /swaps {target_item_id, offered_item_id, message}`).
5. List item — camera/gallery picker (up to 4), resize to ~1200px JPEG, upload each with `POST /uploads` (multipart field `file`) → `{url}`, then `POST /items {title, description, category, condition, value_eur, location, images}`.
6. Swaps — tabs: Offers for me / My offers (`GET /swaps`), accept/decline/cancel (`POST /swaps/{id}/accept|decline|cancel`).
7. Chat — `GET/POST /swaps/{id}/messages` (accepted swaps only), poll ~4s.
8. Payments — after acceptance the proposer pays the processing fee: `POST /payments/swap-fee {swap_id, origin_url}` → open `checkout_url`, poll `GET /payments/status/{session_id}`. Optional label: `GET /shipping/sizes`, `POST /payments/label {...}`, PDF at `GET /labels/{id}/pdf`. History: `GET /payments/history`. (Fees are for a real-world service between users, which generally may use Stripe rather than in-app purchase — confirm with store guidelines.)
9. Notifications — `GET /notifications`, `POST /notifications/{id}/read`, `POST /notifications/read-all`.

## Fee rules (display only — server enforces)
Free to list/offer. Proposer pays 5% of the target item's value (min €0.99, max €19.99) within 48h of acceptance. Senders pay their own postage; labels optional (DEMO for now).

## Native push (backend work needed later)
Web push already exists (VAPID). Native push needs a new backend endpoint to store Expo push tokens and send via Expo's push API — add when the mobile project starts.

## Brand
Neo-brutalist pastel: background #FAFAF7, ink #0F172A, emerald #34D399/#047857, amber #FCD34D, 2px ink borders with 4px offset shadow. Fonts: Outfit (headings), Plus Jakarta Sans (body). App icon: frontend/public/icon-512.png.
