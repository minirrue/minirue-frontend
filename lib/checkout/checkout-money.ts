/**
 * The checkout money rules, and nothing that needs a validation library.
 *
 * This was `checkout-schemas.ts`, which exported two zod schemas alongside
 * these five values. The schemas had **no consumers anywhere in the app** —
 * `checkoutAddressSchema`, `checkoutPaymentSchema` and their inferred types
 * were referenced by nothing — but `CartContext` imports `subtotalToMinor`
 * from here, and `CartProvider` is mounted in the ROOT layout.
 *
 * So one three-line arithmetic helper pulled **all of zod into the first-load
 * bundle of every page on the site**: ~230 KB uncompressed, ~63 KB brotli, 91%
 * of a single 253 KB chunk measured on the live product page. It was the
 * largest library on that route after react-dom, and it was there to support
 * dead code.
 *
 * That is the whole mechanism behind both symptoms in #7 — the product page
 * and the cart are precisely the two things `CartContext` is on the critical
 * path for.
 *
 * The rule that keeps it fixed: **nothing in this file may import a library.**
 * It is reached from the root layout, so anything added here ships to every
 * visitor on every page. Schemas, formatters and API clients belong in modules
 * the checkout routes import directly.
 *
 * That rule is why shipping is a PARAMETER here and not a fetch (#38). The
 * flat rate is an admin setting now, so somebody has to read it from the API —
 * but it cannot be this module. `lib/api/settings.ts` does the reading; this
 * module does the arithmetic on whatever it is handed, and falls back to the
 * same default the backend falls back to when it cannot read its own settings
 * row.
 */


/**
 * Shipping when the shop's configured rate is not known.
 *
 * Mirrors the backend's `DEFAULT_SHIPPING_AMOUNT_MINOR`, which is what
 * `shippingMinorFor` in `orders-checkout.service.ts` charges when its own
 * settings read fails. Matching that fallback means the worst case is the two
 * sides agreeing on the old number, not disagreeing on two different ones.
 *
 * It is a DEFAULT, not the rate. Anything that can reach the API should pass a
 * policy loaded from `lib/api/settings.ts` instead.
 */
export const DEFAULT_SHIPPING_FLAT_MINOR = 5_000;

/**
 * @deprecated The shop's flat rate is an admin setting (#38) — read it with
 * `loadShippingPolicy()` from `lib/api/settings.ts` and pass the result to
 * `shippingMinorFor`. Kept as an alias because the checkout routes still
 * import this name; it is the fallback, never the authority.
 */
export const SHIPPING_AMOUNT_MINOR = DEFAULT_SHIPPING_FLAT_MINOR;

/**
 * What the shop charges to deliver, as the dashboard has it.
 *
 * `freeOverMinor` of 0 means "no threshold", exactly as the backend reads it —
 * without that convention every order would ship free, since every subtotal is
 * `>= 0`.
 */
export interface ShippingPolicy {
  flatMinor: number;
  freeOverMinor: number;
}

export const DEFAULT_SHIPPING_POLICY: ShippingPolicy = {
  flatMinor: DEFAULT_SHIPPING_FLAT_MINOR,
  freeOverMinor: 0,
};

/**
 * Delivery for a bag of this size.
 *
 * `subtotalMinor` is the bag BEFORE any discount. That is the backend's
 * default `freeShippingBasis` ('BEFORE_DISCOUNT'): a shopper who filled a
 * EGP 1,200 bag earned free delivery, and taking it back the instant they type
 * a code reads as a bug rather than a policy.
 *
 * `>=`, not `>`, for the same reason the backend uses `>=` — a threshold
 * advertised as "over EGP 3,000" that refuses a bag of exactly EGP 3,000 is a
 * complaint waiting to happen, and the two sides must agree on the boundary or
 * the quoted total is wrong for precisely the orders that sit on it.
 */
export function shippingMinorFor(
  subtotalMinor: number,
  policy: ShippingPolicy = DEFAULT_SHIPPING_POLICY,
): number {
  const flat = Number.isFinite(policy.flatMinor) && policy.flatMinor >= 0
    ? Math.round(policy.flatMinor)
    : DEFAULT_SHIPPING_FLAT_MINOR;
  const freeOver = Number.isFinite(policy.freeOverMinor) && policy.freeOverMinor > 0
    ? Math.round(policy.freeOverMinor)
    : 0;

  if (freeOver > 0 && subtotalMinor >= freeOver) return 0;
  return flat;
}

export function subtotalToMinor(subtotalAmount: string): number {
  return Math.round(parseFloat(subtotalAmount || '0') * 100);
}

/**
 * Subtotal − discount + shipping, floored at the shipping fee.
 *
 * The discount is floored against the goods BEFORE shipping is added, which is
 * the order the backend applies them in. Flooring after would let a large
 * enough discount eat the delivery charge as well, and the order would be
 * placed for less than the shop is charged to send it.
 */
export function orderTotalMinor(
  subtotalAmount: string,
  options: { discountMinor?: number; shipping?: ShippingPolicy | number } = {},
): number {
  const subtotalMinor = subtotalToMinor(subtotalAmount);
  const discountMinor = Math.max(0, options.discountMinor ?? 0);
  const shippingMinor =
    typeof options.shipping === 'number'
      ? options.shipping
      : shippingMinorFor(subtotalMinor, options.shipping ?? DEFAULT_SHIPPING_POLICY);

  return Math.max(0, subtotalMinor - discountMinor) + shippingMinor;
}

/**
 * Whether cash on delivery is allowed for this bag.
 *
 * `limitMinor` is the shop's own setting (minirue-backend#105): `null` means no
 * limit — the default — and COD is allowed at any total. There is no local copy
 * of a limit any more; the old hard-coded 50 000 refused COD on every order
 * over EGP 500 whatever the dashboard said.
 */
export function isCodAvailable(
  subtotalAmount: string,
  limitMinor: number | null,
  options: { discountMinor?: number; shipping?: ShippingPolicy | number } = {},
): boolean {
  return limitMinor === null || orderTotalMinor(subtotalAmount, options) <= limitMinor;
}
