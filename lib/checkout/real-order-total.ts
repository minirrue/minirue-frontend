/**
 * `payment_initiated.totalMinor`, computed from the shop's real numbers.
 *
 * Both checkout screens used to fire this with `orderTotalMinor(subtotalAmount)`
 * and nothing else — no options, so it fell straight through to
 * `DEFAULT_SHIPPING_POLICY` (the EGP 50 fallback the backend only charges when
 * its OWN settings read fails) and applied no discount at all, even with a code
 * on the order. The real flat rate is EGP 100 and a code or an automatic
 * sitewide offer both cut the total, so the funnel's tracked revenue was wrong
 * in both directions (frontend#142).
 *
 * This asks the two things `orderTotalMinor` needs from the shop itself —
 * `loadShippingPolicy()`, the same read the payment step's own total uses, and
 * `previewDiscount`, which prices the CODE if one is applied and still folds in
 * an automatic offer when `code` is `null` (see `useAutomaticDiscount`'s own
 * comment for why one call covers both cases). Neither read can throw here: a
 * failed settings read falls back to the backend's own default policy, exactly
 * as `loadShippingPolicy` documents, and a failed preview is treated as no
 * discount rather than blocking the event.
 */

import { loadAppliedCode, previewDiscount, type DiscountPreviewLine } from '@/lib/api/discounts';
import { loadShippingPolicy } from '@/lib/api/settings';
import { orderTotalMinor } from '@/lib/checkout/checkout-money';

export async function realOrderTotalMinor(
  subtotalAmount: string,
  lines: DiscountPreviewLine[],
): Promise<number> {
  const [shipping, discount] = await Promise.all([
    loadShippingPolicy().catch(() => undefined),
    previewDiscount(lines, loadAppliedCode()).catch(() => null),
  ]);

  const discountMinor = discount?.valid ? discount.discountMinor : 0;
  return orderTotalMinor(subtotalAmount, { discountMinor, shipping });
}
