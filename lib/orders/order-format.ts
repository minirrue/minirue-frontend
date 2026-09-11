import { formatMoney } from '@/lib/format/money';

/**
 * The reference a customer reads off their confirmation email and types into
 * the search box. Must survive orderSeq === 0 — a falsy number.
 */
export function formatOrderRef(order: { orderSeq: number }): string {
  return `#${order.orderSeq}`;
}

/**
 * An order total as money.
 *
 * The API sends NUMERIC as a string with four decimal places, so the order list
 * printed "450.0000 EGP" — a raw database value shown to a customer. This used
 * to fix two decimals of its own, which meant order history said "EGP 450.00"
 * about a product the card had priced "EGP 450". One rule now, in
 * `lib/format/money.ts`, for every price on the site (#1).
 */
export function formatOrderTotal(amount: string, currency: string): string {
  return formatMoney(amount, currency);
}

/** Human label for an order status, e.g. PENDING -> Pending. */
export function formatOrderStatus(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}
