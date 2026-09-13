import {
  DEFAULT_SHIPPING_POLICY,
  type ShippingPolicy,
} from '@/lib/checkout/checkout-money';
import {
  DEFAULT_EFFECTIVE_SHIPPING,
  DEFAULT_SHIPPING_AMOUNT_MINOR,
  minFeeCentsFor,
  resolveGovernorateRates,
  type EffectiveShipping,
} from '@/lib/checkout/governorate-rates';

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
  /**
   * PRESENT since #85 — the note above is the history, not the present tense.
   *
   * Verified against the live endpoint on 2026-09-12:
   *
   *     "shipping": { "flatRateCents": 10000, "freeOverCents": 0,
   *                   "currency": "EGP", "freeShippingBasis": "BEFORE_DISCOUNT",
   *                   "rates": [], "minFeeCents": 10000 }
   *
   * Every field below stays optional anyway. The shop this ships to is not the
   * only deploy of this frontend, an older backend is a 404 away, and #38's
   * whole lesson is that a client which assumes a field exists is a client that
   * shows the wrong number when it does not.
   */
  currency?: string | null;
  freeShippingBasis?: string | null;
  /**
   * The admin's per-governorate table (#83). Typed `unknown[]` deliberately:
   * the stored document may not match the write schema that produced it, and
   * `resolveGovernorateRates` is the only thing allowed to decide which rows
   * are chargeable. Declaring this `GovernorateRate[]` would be the client
   * trusting storage, which is the defect the guards exist to prevent.
   *
   * An EMPTY array is the whole back-compat guarantee: it means "no table", and
   * every reader behaves exactly as it did before #83. That is what the live
   * shop returns today.
   */
  rates?: unknown[] | null;
  /** Cheapest delivery in the shop — DECISION 2 of #83, see `minFeeCentsFor`. */
  minFeeCents?: number | null;
}

/**
 * The COD ceiling, published so the storefront stops mirroring it as a
 * constant.
 *
 * The storefront used to keep a hand-copy of the limit in `checkout-money.ts`.
 * That stopped being harmless once #83 made the total depend on the
 * governorate — the same bag can be under a limit in Cairo and over it in
 * Aswan — so the number that decides has to be the shop's own. The copy is
 * gone.
 *
 * `null` means no limit (minirue-backend#105). The backend used to publish its
 * hard-coded 50000 here as though it were a setting; it now publishes the
 * admin's stored value, which is `null` until one is set.
 */
export interface PublicPaymentSettings {
  codMaxOrderMinor?: number | null;
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
  /** Present since #85; still optional, for the reason stated on the interface. */
  shipping?: PublicShippingSettings | null;
  /** Present since #83's backend half. Optional for the same reason. */
  payments?: PublicPaymentSettings | null;
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
 * The flat rate and the threshold, and nothing about governorates — this is
 * the pre-#83 shape, kept because the bag's `useShippingPolicy()` and its
 * tests speak it. The body now delegates to `loadEffectiveShipping()` below so
 * there is ONE reader, not two that can disagree about what an absent
 * `flatRateCents` means.
 *
 * Every branch there mirrors the backend's `shippingMinorFor` exactly, because
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
  const effective = await loadEffectiveShipping();
  return {
    flatMinor: effective.flatRateCents,
    freeOverMinor: effective.freeOverCents,
  };
}

/**
 * Turn the published `shipping` block into the guarded policy every screen
 * reads — the flat rate, the threshold, AND the per-governorate table (#83).
 *
 * This is the superset `loadShippingPolicy()` above now delegates to. The old
 * signature survives because the bag's `useShippingPolicy()` and its tests
 * still speak it and there is no reason to churn them; it simply drops the two
 * fields it never had.
 *
 * ## How much of the backend is mirrored here
 *
 * Stated rather than implied, because #83 asks for the evidence on whether
 * `POST /v1/checkout/quote` is worth building:
 *
 *   - the flat-rate / threshold guards below   — `resolveEffectiveShipping`
 *   - `resolveGovernorateRates`                — copied verbatim
 *   - `normaliseGovernorate` + the match passes — copied verbatim
 *   - `quoteShipping` and DECISION 1           — copied verbatim
 *
 * all in `lib/checkout/governorate-rates.ts`. A quote endpoint deletes that
 * file and this function's body, and leaves the rendering.
 *
 * `payments.codMaxOrderMinor` is read here too rather than from a separate
 * call: it gates the TOTAL, the total now moves with the governorate, and one
 * settings read should answer both halves of one question.
 *
 * A failed read is the default, never a thrown error — a settings request that
 * 404s, times out, or comes back from an older backend must never be the reason
 * a shopper cannot see their bag. The server recomputes the real total at Place
 * order either way.
 */
export async function loadEffectiveShipping(): Promise<EffectiveShipping> {
  try {
    return resolveEffectiveShipping(await apiGetPublicSettings());
  } catch {
    return DEFAULT_EFFECTIVE_SHIPPING;
  }
}

/**
 * The pure half of `loadEffectiveShipping` — payload in, policy out.
 *
 * Split out so tests can drive it with the shapes that actually turn up on the
 * wire (a fee stored as a string, a `rates` that is an object, an older backend
 * with no `shipping` key at all) without standing up a fetch mock for each.
 *
 * Mirrors the backend's `resolveEffectiveShipping`, including the part that
 * looks redundant: `currency` is the STORE currency, not `shipping.currency`.
 * Checkout constructs every money value with the store's, and never reads the
 * shipping block's at all, so publishing the stored value would put a label on
 * the delivery line that no part of the server honours.
 */
export function resolveEffectiveShipping(
  settings: Pick<PublicSettings, 'shipping' | 'currency'>,
): EffectiveShipping {
  const shipping = settings.shipping;

  const flatRateCents =
    typeof shipping?.flatRateCents === 'number' && shipping.flatRateCents >= 0
      ? Math.round(shipping.flatRateCents)
      : DEFAULT_SHIPPING_POLICY.flatMinor;

  const freeOverCents =
    typeof shipping?.freeOverCents === 'number' && shipping.freeOverCents > 0
      ? Math.round(shipping.freeOverCents)
      : 0;

  const rates = resolveGovernorateRates(shipping);

  return {
    flatRateCents,
    freeOverCents,
    currency:
      typeof settings.currency === 'string' && settings.currency.trim()
        ? settings.currency.trim()
        : DEFAULT_EFFECTIVE_SHIPPING.currency,
    freeShippingBasis:
      shipping?.freeShippingBasis === 'AFTER_DISCOUNT'
        ? 'AFTER_DISCOUNT'
        : 'BEFORE_DISCOUNT',
    rates,
    minFeeCents: minFeeCentsFor(flatRateCents, rates, shipping?.minFeeCents),
  };
}

/**
 * The cash-on-delivery limit in minor units, or `null` for none.
 *
 * Trusts what the shop publishes and invents nothing (minirue-backend#105).
 * There is deliberately no local fallback number: a backend from before #105
 * publishes its own 50000 explicitly, so it is still honoured; the current one
 * publishes the admin's setting, `null` by default. When the settings cannot
 * be read at all, COD is shown as available — the owner's default — and the
 * server, which enforces the real limit at place-order, stays the authority.
 */
export async function loadCodMaxOrderMinor(): Promise<number | null> {
  try {
    const settings = await apiGetPublicSettings();
    const published = settings.payments?.codMaxOrderMinor;
    return typeof published === 'number' &&
      Number.isFinite(published) &&
      published >= 0
      ? Math.round(published)
      : null;
  } catch {
    return null;
  }
}

// `DEFAULT_SHIPPING_AMOUNT_MINOR` is re-exported so a caller that only needs
// the fallback figure does not have to reach past this module into the mirror.
export { DEFAULT_SHIPPING_AMOUNT_MINOR };
