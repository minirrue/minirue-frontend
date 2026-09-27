# Assisted order customer review

`/booth/review/[token]` is an opaque bearer review link issued by the staff dashboard. It fetches `GET /v1/orders/ground/review/:token` every four seconds while waiting for staff, pauses in hidden tabs, and stops at COMPLETED or EXPIRED. It never creates orders or accepts payment. The public DTO contains no customer contacts or internal customer ID.

All displayed money and loyalty projections come from the frozen backend quote, in integer piastres. Ground completion means paid and handed over; Online completion means staff-confirmed order with rewards pending delivery. No public page call sends a purchase analytics event.

Completed review offers signup/login with a safe local return path. A signed-in customer can explicitly claim via `POST /v1/orders/ground/review/:token/claim`; the backend verifies ownership and applies idempotent linking/reward rules. Refusal never reports success. Phone-only contacts remain pending until an SMS verification provider is configured. A staff-created contact does not imply a login account.

Review URLs and auth return URLs are excluded from first-party event collection and Meta/TikTok scripts, have no-store/no-referrer/noindex headers, and do not populate attribution cookies. Shopping overlays are hidden to keep the receipt clear.

Visual acceptance should cover 320, 390, 768, 1024 and 1440 pixel widths; waiting, completed Ground, completed Online, expired and connection failure; signed-out, signed-in claim success and claim refusal. Automated tests cover money display, polling transition, Online/Ground distinction, expiry, retry, safe redirect and private-route classification. Do not treat automated tests as rendered acceptance.
