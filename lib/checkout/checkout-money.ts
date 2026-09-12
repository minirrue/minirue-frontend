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
 */

/** COD limit in minor units — mirrors backend `COD_MAX_ORDER_MINOR`. */
export const COD_MAX_ORDER_MINOR = 50_000;

/** Flat shipping in minor units — mirrors backend checkout shipping. */
export const SHIPPING_AMOUNT_MINOR = 5_000;

export function subtotalToMinor(subtotalAmount: string): number {
  return Math.round(parseFloat(subtotalAmount || '0') * 100);
}

export function orderTotalMinor(subtotalAmount: string): number {
  return subtotalToMinor(subtotalAmount) + SHIPPING_AMOUNT_MINOR;
}

export function isCodAvailable(subtotalAmount: string): boolean {
  return orderTotalMinor(subtotalAmount) <= COD_MAX_ORDER_MINOR;
}
