export type CheckoutPaymentMethod = 'COD' | 'INSTAPAY';

export interface CheckoutSession {
  shippingAddressId: string;
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
