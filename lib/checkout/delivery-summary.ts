/**
 * What the order summary shows for delivery once a `DeliveryMethod` is known
 * (frontend#163) — kept separate from `shipping-summary.ts` because that file
 * only knows about the per-governorate rate table, not same-day.
 *
 * The owner's binding decision: for SAME_DAY, the shipping line must read
 * "Confirmed after order (cash on delivery)" — never "0 EGP" with no
 * explanation — and the amount actually CHARGED through checkout is goods
 * only. The same-day fee is confirmed after the order and paid in cash on
 * delivery, so it is never added to the total the payment step or the
 * InstaPay transfer amount asks for.
 */

import type { DeliveryMethod } from './delivery';

export const SAME_DAY_SHIPPING_LABEL = 'Confirmed after order (cash on delivery)';

/**
 * The figure actually charged through checkout: goods only for SAME_DAY
 * (shipping contributes 0, same as the backend), otherwise whatever the
 * governorate-rate summary already computed (goods + the standard fee, minus
 * any free-shipping threshold).
 */
export function totalMinorForDelivery(
  deliveryMethod: DeliveryMethod | null | undefined,
  goodsMinor: number,
  standardTotalMinor: number,
): number {
  return deliveryMethod === 'SAME_DAY' ? Math.max(0, goodsMinor) : standardTotalMinor;
}
