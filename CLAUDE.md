# CLAUDE.md — minirue-frontend (storefront)

## Stack
- Next.js 16.2.4 App Router (latest stable)
- React 19.2.5 (required by Next 16 stable)
- TypeScript 5 (strict mode)
- Tailwind CSS v4 (CSS-first config, no `tailwind.config.ts`)
- GSAP 3.15.0 (ScrollTrigger, SplitText, scroll-reveal, splash animation)

## Deploy target
`minirueshop.com` — public storefront, indexed by search engines.

## Shipping citation
Every shipped change must cite `minirue-frontend@{version} ({short-hash})` in the commit
message. Bump `package.json` version at minor/patch grain — patch for a single fix, minor for a
feature batch, once per batch, not per commit.

## Bundle budget
250KB gzipped JS. GSAP loads lazily per route.

## Route map
| Route | Purpose |
|---|---|
| `/` | Home — SplashScreen + HomeView |
| `/products` | Product listing / catalog |
| `/products/[slug]` | Product detail page |
| `/categories`, `/categories/[slug]` | Category grid, category listing |
| `/brands` | Brand grid |
| `/collab` | Collaborator storefronts |
| `/search` | Search results |
| `/[slug]`, `/[slug]/[child]` | Editorial "space" pages (catch-all) |
| `/cart` | Cart drawer (client-side state) |
| `/checkout`, `/checkout/payment`, `/checkout/instapay`, `/checkout/confirmation` | Checkout flow |
| `/(auth)/login`, `/(auth)/signup`, `/(auth)/forgot`, `/(auth)/reset-password` | Auth |
| `/account` (+ `addresses`, `loyalty`, `notifications`, `orders`, `profile`, `refunds`, `saved`) | Signed-in account area |
| `/orders/[id]` | Order detail |

## Directory conventions
| Path | Contents |
|---|---|
| `app/` | Routes, layouts, pages (App Router) |
| `app/styles/mr-tokens.css` | Design + motion tokens (source of truth) |
| `components/ui/` | Primitives: Button, Badge, Icon, Wordmark, etc. |
| `components/layout/` | Header, Footer, CartDrawer |
| `components/storefront/` | ProductCard, ProductGrid, Hero, EditorialBlock |
| `lib/api/` | Typed fetchers for the live backend (catalog, orders, auth, etc.) |
| `lib/motion/` | Spring integrator, useScrollReveal, useEnterSpring |
| `lib/hooks/` | useBreakpoint, useCartStore, etc. |

## Motion rules
- Always use `--mr-ease-*` and `--mr-dur-*` tokens from `mr-tokens.css`.
- GSAP for splash + scroll-reveal. CSS transitions for button/card micro-interactions.
- Never animate `width`, `height`, `top`, `left`, `margin`, `padding` — transform + opacity only.
- Never put CSS `transform` on a parent of `position:fixed` children.
- Reduced-motion: `prefers-reduced-motion` already handled in `mr-tokens.css`.

## Build phase constraints
- No `app/api` route handlers of its own — all data comes from a separate
  backend service via `lib/api/*` (`NEXT_PUBLIC_API_URL`, defaults to
  `http://localhost:8002`). No Server Actions.
- `proxy.ts` (Next's middleware convention, just renamed) gates `/account`
  and `/orders` behind the `mr-auth` cookie, redirecting guests to `/login`.
  It does not gate `/cart` or `/checkout` — guests can hold a cart and reach
  checkout — but a guest CANNOT BUY. That gate is the backend's:
  `CustomerOrdersController` is `@UseGuards(JwtAuthGuard)` at class level
  (`orders.controller.ts:37`), so every checkout call without a token is
  refused before any money is computed. The line above describes the ROUTE not
  redirecting, nothing more; reading it as "guests can place orders" has
  already misled one piece of work (discounts, 2026-08-01).
- Auth is fully wired end-to-end (login/signup/session) — not a UI-only stub.

## Superrepo reference
Plan: `.claude/memory-bank/001-auth-module/plans/001-auth-module-2026-04-24-minirue-frontend.md`
