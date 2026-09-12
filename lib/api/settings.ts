import {
  DEFAULT_SHIPPING_POLICY,
  type ShippingPolicy,
} from '@/lib/checkout/checkout-money';

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8002') + '/v1';

export interface HeroSlideConfig {
  id: number;
  type: 'photo' | 'editorial';
  eyebrow: string;
  headline: string;
  sub: string;
  tagline: string;
  bg: string;
  bottle?: string;
  cap?: string;
  tile?: string;
}

export interface StorefrontPublicSettings {
  announcementEnabled: boolean;
  announcementMessages: string[];
  announcementLinkUrl?: string | null;
  announcementBackground?: string | null;
  faviconUrl: string | null;
  footerTagline: string | null;
  heroSlides: HeroSlideConfig[];
}

/**
 * What the shop charges to deliver, in minor units, as the dashboard saves it.
 *
 * Optional, and that is the whole story of #38.
 *
 * The dashboard writes `shipping.flatRateCents` and `shipping.freeOverCents`,
 * and checkout honours both (`shippingMinorFor` in the backend's
 * `orders-checkout.service.ts`; the contract is pinned by
 * `settings-roundtrip.db.spec.ts`). But the only endpoint that returns them is
 * `GET /v1/settings`, which is ADMIN-only — `GET /v1/settings/public` today
 * returns `{ storeName, displayName, currency, logoUrl, storefront }` and
 * nothing about shipping at all.
 *
 * So the storefront cannot learn the real rate yet. This field is declared
 * optional rather than guessed at: `loadShippingPolicy()` below reads it when
 * it is there and falls back to the backend's own default when it is not, so
 * the day `/settings/public` starts sending a `shipping` block the cart
 * follows it with no further frontend change. Until then the cart shows the
 * same number it always did — but it shows it because a settings read came
 * back empty, not because the figure is nailed into the bundle.
 */
export interface PublicShippingSettings {
  flatRateCents?: number | null;
  freeOverCents?: number | null;
}

export interface PublicSettings {
  /** Constant, not an editable setting — the shop's fixed legal name. */
  storeName: string;
  /**
   * The ONE admin-editable shop display name (2026-07-31 owner ask) — the
   * chat widget's header/sender name reads this rather than a hardcoded
   * "MiniRue Support" literal. Never empty: falls back server-side to
   * `DEFAULT_SHOP_DISPLAY_NAME` ("MiniRue") when unset.
   */
  displayName: string;
  currency: string;
  logoUrl: string | null;
  storefront: StorefrontPublicSettings;
  /** Absent on every deploy of the backend to date — see the note above. */
  shipping?: PublicShippingSettings | null;
}

export async function apiGetPublicSettings(): Promise<PublicSettings> {
  // 60s revalidate (Next.js Data Cache) — plain fetch option, safe from both
  // Server and Client Components, unlike the 'use cache' directive.
  const res = await fetch(`${BASE}/settings/public`, {
    next: { revalidate: 60 },
  } as RequestInit);
  if (!res.ok) {
    throw new Error('Failed to load store settings');
  }
  return res.json() as Promise<PublicSettings>;
}

/**
 * Turn whatever `/settings/public` says about shipping into a policy the money
 * helpers can use.
 *
 * Every branch here mirrors the backend's `shippingMinorFor` exactly, because
 * the only thing worse than the cart quoting the wrong delivery fee is the
 * cart and checkout disagreeing about which wrong fee it is:
 *
 *   - a numeric `flatRateCents >= 0` is the rate; anything else is the default
 *   - `freeOverCents > 0` is the threshold; 0, null or missing disables it
 *   - a failed read is the default, never a thrown error
 *
 * That last one matters most. A settings request that 404s, times out, or
 * comes back from an older backend must never be the reason a shopper cannot
 * see their bag — the server recomputes the real total at Place order either
 * way.
 *
 * This lives in `lib/api`, NOT in `lib/checkout/checkout-money.ts`: that module
 * is reached from the root layout and may not import anything (#7). The rule is
 * the constant becomes a parameter, and the fetch lives where the routes that
 * need it can import it directly.
 */
export async function loadShippingPolicy(): Promise<ShippingPolicy> {
  try {
    const settings = await apiGetPublicSettings();
    const shipping = settings.shipping;

    const flatMinor =
      typeof shipping?.flatRateCents === 'number' && shipping.flatRateCents >= 0
        ? Math.round(shipping.flatRateCents)
        : DEFAULT_SHIPPING_POLICY.flatMinor;

    const freeOverMinor =
      typeof shipping?.freeOverCents === 'number' && shipping.freeOverCents > 0
        ? Math.round(shipping.freeOverCents)
        : 0;

    return { flatMinor, freeOverMinor };
  } catch {
    return DEFAULT_SHIPPING_POLICY;
  }
}
