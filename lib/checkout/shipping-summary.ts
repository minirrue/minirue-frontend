/**
 * What the delivery row says, on every screen that has one.
 *
 * Separate from `governorate-rates.ts` on purpose. That file is a verbatim
 * mirror of the backend and is meant to be DELETED the day `POST
 * /v1/checkout/quote` exists. This one is a storefront decision the backend has
 * no opinion about — DECISION 2 of #83, in the issue's own words: "what the
 * cart shows before an address is a frontend call".
 *
 * ## The problem it solves
 *
 * The bag has a shipping row and promises a total, and it draws both before any
 * address exists. Before #83 that was honest: one flat rate, one number, the
 * same number checkout charged. With per-governorate rates the fee is not
 * knowable at the bag, and there are exactly two dishonest ways to cope —
 *
 *   - quote the global rate as if it were settled, and let a shopper in Aswan
 *     meet a bigger number at the address step, or
 *   - quote the cheapest rate as if it were settled, which is the same failure
 *     pointing the other way and reads as a bait price.
 *
 * So: **the bag stops promising a total it cannot know, and says so in one
 * word.** `fromOnly` is that word. The figure it carries is `minFeeCents` —
 * the shop's own published floor, which excludes disabled rows — and the total
 * built on it is a floor too. Every later screen can only move it UP, and the
 * one that finally charges is the server.
 *
 * ## When the bag CAN still promise
 *
 * Two cases, and they are why this is a function rather than a rule of thumb:
 *
 *   - **no rate table** (`rates: []`, which is what the live shop returns
 *     today). Nothing can move the fee, so the bag quotes it outright and the
 *     pre-#83 screen is unchanged — back-compat is a code path, not a promise.
 *   - **free shipping already applies.** `FREE_SHIPPING_BEATS_GOVERNORATE_RATE`
 *     is the backend's default, so a bag over the threshold ships free from
 *     every governorate there is. "Free" is exact, and hedging it with "from"
 *     would take back a promise the shop already made on the product page.
 *
 * Both fall out of mirroring the backend rather than being bolted on, which is
 * the only reason they can be trusted.
 */

import {
  quoteShipping,
  subtotalForBasis,
  type EffectiveShipping,
  type ResolvedGovernorateRate,
} from './governorate-rates';

export interface ShippingSummary {
  /**
   * The delivery figure to render, in minor units.
   *
   * A firm price when `fromOnly` is false. A LOWER BOUND when it is true —
   * render it as "from EGP X" and never as a bare amount, or the screen has
   * quietly made the promise this type exists to avoid.
   */
  feeMinor: number;
  /** The free-delivery threshold took it to zero. Exact, never a bound. */
  free: boolean;
  /**
   * True when no governorate is known yet AND the shop has a rate table, so
   * `feeMinor` and `totalMinor` are floors rather than figures.
   */
  fromOnly: boolean;
  /** `max(0, subtotal − discount) + feeMinor`. A floor when `fromOnly`. */
  totalMinor: number;
  /**
   * Why the fee is what it is. `null` before an address exists — there is no
   * resolution to report, which is different from a resolution that missed.
   */
  resolved: ResolvedGovernorateRate | null;
}

export interface ShippingSummaryInput {
  effective: EffectiveShipping;
  /** The bag BEFORE any discount, in minor units. */
  subtotalMinor: number;
  /** What a code or automatic offer takes off the goods. */
  discountMinor?: number;
  /**
   * The free text off the address, or `undefined`/`null` when there is no
   * address yet. An EMPTY STRING is not the same thing: that is an address that
   * carries no governorate, which resolves (to `NO_GOVERNORATE`) and is billed
   * the global rate. Passing one deliberately gives the firm answer for it.
   */
  governorate?: string | null;
}

export function shippingSummary({
  effective,
  subtotalMinor,
  discountMinor = 0,
  governorate,
}: ShippingSummaryInput): ShippingSummary {
  const discount = Math.max(0, discountMinor);
  const goodsMinor = Math.max(0, subtotalMinor - discount);

  // Whichever figure the shop's `freeShippingBasis` judges the threshold on —
  // the bag before the discount by default, so applying a code never takes free
  // delivery back.
  const thresholdSubtotal = subtotalForBasis(effective, subtotalMinor, discount);

  const known = typeof governorate === 'string';
  const quote = quoteShipping(
    effective,
    thresholdSubtotal,
    known ? governorate : undefined,
  );

  // Free beats everything, including not knowing where the parcel is going.
  // DECISION 1, mirrored — not a second rule invented here.
  if (quote.freeShippingApplied) {
    return {
      feeMinor: 0,
      free: true,
      fromOnly: false,
      totalMinor: goodsMinor,
      resolved: known ? quote.rate : null,
    };
  }

  if (known) {
    return {
      feeMinor: quote.feeCents,
      free: false,
      fromOnly: false,
      totalMinor: goodsMinor + quote.feeCents,
      resolved: quote.rate,
    };
  }

  // No address yet. With no table the global rate is the only answer there is,
  // so it is a firm one and the bag reads exactly as it did before #83.
  if (effective.rates.length === 0) {
    return {
      feeMinor: effective.flatRateCents,
      free: false,
      fromOnly: false,
      totalMinor: goodsMinor + effective.flatRateCents,
      resolved: null,
    };
  }

  // A table exists and nothing has been chosen: the floor, labelled as one.
  return {
    feeMinor: effective.minFeeCents,
    free: false,
    fromOnly: true,
    totalMinor: goodsMinor + effective.minFeeCents,
    resolved: null,
  };
}
