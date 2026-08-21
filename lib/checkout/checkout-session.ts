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
  paymentMethod: CheckoutPaymentMethod;
  receiptDataUrl?: string;
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

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
