/**
 * Product page trust row — pure derivations (frontend#189).
 *
 * The owner's ask, verbatim: "if dashboard says 0 shipping then advertise on
 * product page free shipping, also high quality packaging premium one, also
 * shipping on same day in cairo and giza as marked on dashboard, so dynamic
 * data can be advertised in our each per product page better."
 *
 * Every function here reads only from the same live settings checkout and the
 * bag already trust — `EffectiveShipping` (governorate-rates.ts),
 * `DeliverySettings` (delivery.ts) and the COD ceiling (checkout-money.ts). A
 * claim this module cannot derive from those settings is a claim it returns
 * nothing for; the caller renders no chip rather than a placeholder.
 *
 * No React, no fetch — cheap to test with a fixed settings fixture, and kept
 * out of `ApiProductDetail.tsx` so the derivation is one thing to get right
 * rather than logic tangled into JSX.
 */

import type { EffectiveShipping } from './governorate-rates';
import type { DeliverySettings } from './delivery';
import { GOVERNORATES, type GovernorateKey } from './governorates';
import { isCodAvailable } from './checkout-money';

/** English label for a governorate key, or the key itself if unrecognised. */
function governorateLabel(key: GovernorateKey | string): string {
  return GOVERNORATES.find((g) => g.key === key)?.en ?? key;
}

export interface FreeDeliveryResult {
  /** Free everywhere the shop delivers — no governorate list needed. */
  allFree: boolean;
  /**
   * Populated only when `allFree` is false: the ENABLED governorates whose
   * own rate is exactly zero. Empty means nothing is provably free — render
   * no chip, never a bare "Free delivery".
   */
  governorateLabels: string[];
}

/**
 * Where delivery is free, derived from the same table `quoteShipping` charges
 * from. Returns `null` when nothing here is free at all.
 */
export function resolveFreeDelivery(effective: EffectiveShipping): FreeDeliveryResult | null {
  const enabledRates = effective.rates.filter((r) => r.enabled);
  const zeroFeeRates = enabledRates.filter((r) => r.feeCents === 0);
  const nonZeroRates = enabledRates.filter((r) => r.feeCents > 0);

  // The global rate is zero and nothing overrides it upward: free for every
  // governorate this shop ships to.
  if (effective.flatRateCents === 0 && nonZeroRates.length === 0) {
    return { allFree: true, governorateLabels: [] };
  }

  // Otherwise, free ONLY where an explicit zero-fee row says so.
  if (zeroFeeRates.length > 0) {
    return { allFree: false, governorateLabels: zeroFeeRates.map((r) => governorateLabel(r.key)) };
  }

  return null;
}

/**
 * Which governorates same-day delivery is actually offered in, straight from
 * the dashboard's fulfillment settings — never a hardcoded "Cairo, Giza".
 * Empty when same-day is off or the owner has named no governorate for it.
 */
export function resolveSameDayGovernorates(delivery: DeliverySettings): string[] {
  if (!delivery.sameDay.enabled) return [];
  return delivery.sameDay.governorates.map(governorateLabel);
}

/**
 * Cash on delivery for THIS product, at THIS price — not a shop-wide toggle.
 * `priceAmount` is the price actually shown for the selected variant, so a
 * product priced above the COD ceiling never advertises a promise the address
 * step would refuse.
 */
export function resolveCodAvailable(priceAmount: string, codMaxOrderMinor: number | null): boolean {
  return isCodAvailable(priceAmount, codMaxOrderMinor);
}
