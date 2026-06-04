# CLAUDE.md — minirue-frontend (storefront)

## Stack
- Next.js 16.2.4 App Router (latest stable)
- React 19.2.5 (required by Next 16 stable)
- TypeScript 5 (strict mode)
- Tailwind CSS v4 (CSS-first config, no `tailwind.config.ts`)
- GSAP 3.15.0 (ScrollTrigger, SplitText, scroll-reveal, splash animation)

## Deploy target
`minirue.com` — public storefront, indexed by search engines.

## Bundle budget
250KB gzipped JS. GSAP loads lazily per route.

## Route map
| Route | Purpose |
|---|---|
| `/` | Home — SplashScreen + HomeView (Phase 3) |
| `/products/[slug]` | Product detail page (Phase 3) |
| `/(auth)/login` | Login (Phase 1 — auth module) |
| `/(auth)/signup` | Sign up (Phase 1) |
| `/(auth)/forgot` | Forgot password (Phase 1) |
| `/cart` | Cart drawer (Phase 3 — client-side state) |

## Directory conventions
| Path | Contents |
|---|---|
| `app/` | Routes, layouts, pages (App Router) |
| `app/styles/mr-tokens.css` | Design + motion tokens (source of truth) |
| `components/ui/` | Primitives: Button, Badge, Icon, Wordmark, etc. |
| `components/layout/` | Header, Footer, CartDrawer |
| `components/storefront/` | ProductCard, ProductGrid, Hero, EditorialBlock |
| `lib/mock/` | Static mock data (products, collections) — Build phase only |
| `lib/motion/` | Spring integrator, useScrollReveal, useEnterSpring |
| `lib/hooks/` | useBreakpoint, useCartStore, etc. |

## Motion rules
- Always use `--mr-ease-*` and `--mr-dur-*` tokens from `mr-tokens.css`.
- GSAP for splash + scroll-reveal. CSS transitions for button/card micro-interactions.
- Never animate `width`, `height`, `top`, `left`, `margin`, `padding` — transform + opacity only.
- Never put CSS `transform` on a parent of `position:fixed` children.
- Reduced-motion: `prefers-reduced-motion` already handled in `mr-tokens.css`.

## Build phase constraints
- Static-only: no API routes, no Server Actions, no middleware.
- Mock data lives in `lib/mock/` — no fetch calls to backend.
- Auth forms are UI-only stubs; POST wired in Phase 1 backend integration.

## Superrepo reference
Plan: `.claude/memory-bank/001-auth-module/plans/001-auth-module-2026-04-24-minirue-frontend.md`
