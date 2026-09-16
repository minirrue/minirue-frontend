import type { DeliveryLocation, DeliveryMethod } from './delivery';

export type CheckoutPaymentMethod = 'COD' | 'INSTAPAY';

/** A guest's own details, typed at checkout. Never an account. */
export interface GuestCheckoutDetails {
  fullName: string;
  email: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  governorate: string;
  postalCode?: string;
}

export interface CheckoutSession {
  /** Signed-in shoppers: the saved address they picked. */
  shippingAddressId?: string;
  /**
   * Guests: the details they typed instead (2026-08-21).
   *
   * sessionStorage, so it survives the walk from Delivery to Payment to
   * Confirmation and a mid-flow reload, and is gone when the tab closes —
   * a shared computer must not leave somebody's address and phone number
   * behind for the next person.
   */
  guest?: GuestCheckoutDetails;
  /**
   * The governorate the delivery step settled on, as FREE TEXT (#83).
   *
   * Written at the address step so the payment step can quote the same
   * delivery fee without re-fetching the customer's address list — a signed-in
   * shopper's governorate lives on an address the payment screen never loads,
   * and a summary that falls back to the global rate one screen before payment
   * is the "cart says 50, invoice says 120" failure in miniature.
   *
   * The TEXT, deliberately, not the resolved key or the fee:
   *
   *   - the text is what the server will match, so re-resolving it here gives
   *     the server's answer rather than a remembered one. A key would have to
   *     be trusted; a price would have to be trusted twice.
   *   - a stored PRICE could survive an admin editing the table mid-checkout
   *     and be shown against a fee the backend no longer charges.
   *
   * Absent for a session that started before this shipped, and absent is
   * handled: the payment step falls back to the global rate, which is what it
   * showed before #83.
   */
  shippingGovernorate?: string;
  /**
   * The delivery step's choice (frontend#163) — set the moment the shopper
   * commits to Delivery, same as `shippingGovernorate`, so Payment and
   * InstaPay can send it explicitly without re-asking. `deliveryLocation` is
   * only ever set alongside `SAME_DAY`; `resolveDeliveryLocation` in
   * `lib/checkout/delivery.ts` is what decided it was usable.
   */
  deliveryMethod?: DeliveryMethod;
  deliveryLocation?: DeliveryLocation;
  paymentMethod: CheckoutPaymentMethod;
  receiptDataUrl?: string;
  /**
   * The Idempotency-Key for this checkout attempt. Minted once and kept here
   * so a RETRY sends the same one -- see checkoutIdempotencyKey below.
   */
  idempotencyKey?: string;
  /**
   * The cart the order was SENT against, written just before Place order goes
   * out (#121). A refresh while the order is in flight comes back to a server
   * that has already checked that cart out, so GET /v1/cart answers with no
   * cart at all — and a guest's idempotency record is scoped to this id. The
   * replay needs it to find the order it already made.
   */
  placingCartId?: string;
}

const STORAGE_KEY = 'mr-checkout';

export function loadCheckoutSession(): CheckoutSession | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CheckoutSession;
  } catch {
    return null;
  }
}

export function saveCheckoutSession(patch: Partial<CheckoutSession>): CheckoutSession {
  const next = { ...(loadCheckoutSession() ?? {}), ...patch } as CheckoutSession;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearCheckoutSession(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

/**
 * The Idempotency-Key for this checkout attempt: minted once, then remembered.
 *
 * This used to be `newIdempotencyKey()`, a bare `crypto.randomUUID()` called
 * inline in the request. That is the one thing an idempotency key must never
 * be. The dangerous case is not a double-click -- a ref guard already covers
 * that -- it is the request that SUCCEEDS on the server and whose response is
 * lost on the way back: a timeout, a 502, a dropped connection. The shopper
 * sees an error and presses the button again, a fresh uuid goes out, the
 * server sees a brand-new checkout, and they are charged for a second order.
 * Retrying after a failure is exactly when the key has to stay the same.
 *
 * Held in the same sessionStorage blob as the rest of the checkout, so it also
 * survives a reload -- which resets the in-memory ref guard but not this.
 * `clearCheckoutSession()` runs on success, so the NEXT order correctly gets a
 * new key rather than colliding with the finished one.
 */
export function checkoutIdempotencyKey(): string {
  const existing = loadCheckoutSession()?.idempotencyKey;
  if (existing) return existing;

  const key = crypto.randomUUID();
  // No sessionStorage during SSR; these callers are client-side, but returning
  // a usable key rather than throwing keeps that an implementation detail.
  if (typeof window !== 'undefined') saveCheckoutSession({ idempotencyKey: key });
  return key;
}
