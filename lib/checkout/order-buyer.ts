/**
 * Who placed an order, as far as the confirmation screen needs to know (#134).
 *
 * A guest has no account and no order page (minirue-backend#135: guest orders
 * are handled in the dashboard, and guests get order emails). So the
 * confirmation must never send a guest to "your orders" — it tells them where
 * the emails will go instead.
 */
import type { OrderSummary } from './checkout-api';

export type OrderBuyer =
  | { kind: 'guest'; maskedEmail: string | null }
  | { kind: 'account'; orderId: string | null };

/**
 * `mona.adel@gmail.com` → `m***@gmail.com`: enough for the shopper to spot a
 * typo in their address, not enough to read it off a screen over a shoulder.
 */
export function maskEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim() ?? '';
  const at = trimmed.lastIndexOf('@');
  if (at < 1 || at === trimmed.length - 1) return null;
  return `${trimmed[0]}***${trimmed.slice(at)}`;
}

/**
 * The order the server returned decides first: `guestContact` is set only on a
 * guest order and `userId` only on an account one. Without an order body (an
 * Instapay arrival with only `?order=`, or an older backend) the checkout
 * session's guest details, then the sign-in hint, decide.
 */
export function orderBuyer(
  order: Pick<OrderSummary, 'id' | 'userId' | 'guestContact'> | null,
  fallback: { guestEmail?: string | null; signedIn: boolean },
): OrderBuyer {
  if (order?.guestContact) {
    return {
      kind: 'guest',
      maskedEmail: maskEmail(order.guestContact.email) ?? maskEmail(fallback.guestEmail),
    };
  }
  if (order?.userId) return { kind: 'account', orderId: order.id };
  if (fallback.guestEmail || order?.userId === null || !fallback.signedIn) {
    return { kind: 'guest', maskedEmail: maskEmail(fallback.guestEmail) };
  }
  return { kind: 'account', orderId: order?.id ?? null };
}
