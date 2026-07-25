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
 * printed "450.0000 EGP" — a raw database value shown to a customer. Formatted
 * here so every order view reads the same way.
 */
export function formatOrderTotal(amount: string, currency: string): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${amount} ${currency}`;
  return `${currency} ${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Human label for an order status, e.g. PENDING -> Pending. */
export function formatOrderStatus(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}
