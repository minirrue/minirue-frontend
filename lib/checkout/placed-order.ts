/**
 * The order step 4 placed, remembered for the rest of the tab (#121).
 *
 * Placing an order spends the checkout: `clearCheckoutSession()` wipes the
 * session and the cart is CHECKED_OUT on the server. A refresh of
 * /checkout/confirmation after that found nothing to show and sent the shopper
 * to the Delivery step with "Your bag is empty" — which reads as "the order
 * failed", and invites them to order again.
 *
 * sessionStorage for the same reason as the checkout session itself: it
 * survives a reload and is gone when the tab closes. It holds the order body
 * the server returned, so the refreshed page renders the same receipt.
 */
import type { OrderSummary } from './checkout-api';

const STORAGE_KEY = 'mr-checkout-placed';

export interface PlacedOrderRecord {
  order: OrderSummary;
  /** The Idempotency-Key the order was placed with. */
  idempotencyKey: string;
}

export function savePlacedOrder(order: OrderSummary, idempotencyKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ order, idempotencyKey }));
  } catch {
    // Storage full or blocked: the confirmation on screen is unaffected; only
    // a later refresh loses the receipt.
  }
}

export function loadPlacedOrder(): PlacedOrderRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PlacedOrderRecord>;
    return parsed?.order?.orderNumber && parsed.idempotencyKey
      ? (parsed as PlacedOrderRecord)
      : null;
  } catch {
    return null;
  }
}

/**
 * "Cart already checked out" — the server's answer when the cart this
 * placement names has been consumed by an order.
 *
 * On a replay that is the expected answer for a short window: the backend
 * claims the cart inside the order transaction but records the Idempotency-Key
 * only after it, so a replay that arrives in between is refused rather than
 * answered with the order. It never means "nothing was bought".
 */
export function isCartAlreadyCheckedOut(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const { status, message } = err as { status?: unknown; message?: unknown };
  return status === 400 && typeof message === 'string' && /already checked out/i.test(message);
}

/** Back-off between replays while the server finishes recording the key. */
export const REPLAY_DELAYS_MS: readonly number[] = [1000, 2000, 4000];

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Send a placement, and if the cart turns out to be already checked out,
 * send the SAME request again after each delay.
 *
 * Safe to repeat by construction: the caller reuses one Idempotency-Key, and a
 * checked-out cart cannot be ordered from again, so a repeat can only ever be
 * answered with the order that exists — never create one. Any other failure is
 * thrown at once.
 */
export async function placeWithReplay<T>(
  send: () => Promise<T>,
  delaysMs: readonly number[] = REPLAY_DELAYS_MS,
  sleep: (ms: number) => Promise<void> = wait,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await send();
    } catch (err) {
      if (!isCartAlreadyCheckedOut(err) || attempt >= delaysMs.length) throw err;
      await sleep(delaysMs[attempt]);
    }
  }
}
