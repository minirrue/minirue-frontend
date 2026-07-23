/**
 * The reference a customer reads off their confirmation email and types into
 * the search box. Must survive orderSeq === 0 — a falsy number.
 */
export function formatOrderRef(order: { orderSeq: number }): string {
  return `#${order.orderSeq}`;
}
