import { apiFetch } from './client';

export const BOOTH_SIGNUP_PREFILL_TTL_MS = 5 * 60_000;
const BOOTH_SIGNUP_PREFILL_KEY = 'mr.boothSignupPrefill.v1';
const BOOTH_REVIEW_RETURN = /^\/booth\/review\/([a-f0-9]{64})$/;

export interface BoothSignupContact {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
}

export interface BoothSignupPrefill extends BoothSignupContact {
  next: string;
}

interface StoredBoothSignupPrefill extends BoothSignupPrefill {
  expiresAt: number;
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function validContact(value: unknown): value is BoothSignupContact {
  if (!value || typeof value !== 'object') return false;
  const contact = value as Record<string, unknown>;
  return (
    typeof contact.firstName === 'string' && contact.firstName.length <= 100 &&
    typeof contact.lastName === 'string' && contact.lastName.length <= 100 &&
    typeof contact.phone === 'string' && contact.phone.length > 0 && contact.phone.length <= 40 &&
    (contact.email === undefined ||
      (typeof contact.email === 'string' && contact.email.length <= 320))
  );
}

export function boothReviewTokenFromReturnPath(next: string): string | null {
  return BOOTH_REVIEW_RETURN.exec(next)?.[1] ?? null;
}

export function saveBoothSignupPrefill(prefill: BoothSignupPrefill): void {
  if (!boothReviewTokenFromReturnPath(prefill.next) || !validContact(prefill)) return;
  try {
    storage()?.setItem(
      BOOTH_SIGNUP_PREFILL_KEY,
      JSON.stringify({
        ...prefill,
        expiresAt: Date.now() + BOOTH_SIGNUP_PREFILL_TTL_MS,
      } satisfies StoredBoothSignupPrefill),
    );
  } catch {
    // Storage may be unavailable in private/locked-down browsing. Signup can
    // fetch the same contact from the bounded review-token endpoint instead.
  }
}

export function takeBoothSignupPrefill(next: string): BoothSignupPrefill | null {
  const store = storage();
  if (!store || !boothReviewTokenFromReturnPath(next)) return null;
  try {
    const raw = store.getItem(BOOTH_SIGNUP_PREFILL_KEY);
    if (!raw) return null;
    store.removeItem(BOOTH_SIGNUP_PREFILL_KEY);
    const value = JSON.parse(raw) as Partial<StoredBoothSignupPrefill>;
    if (
      value.next !== next ||
      typeof value.expiresAt !== 'number' ||
      value.expiresAt <= Date.now() ||
      !validContact(value)
    )
      return null;
    const { firstName, lastName, phone, email } = value;
    return { firstName, lastName, phone, ...(email ? { email } : {}), next };
  } catch {
    return null;
  }
}

export interface GroundReview {
  status: 'AWAITING_PAYMENT' | 'COMPLETED' | 'EXPIRED';
  salesMode: 'GROUND' | 'ONLINE';
  currency: 'EGP';
  items: Array<{ id: string; kind: 'VARIANT' | 'BUNDLE'; variantId: string | null; bundleId: string | null; name: string; sku: string | null; sizeMl: number | null; quantity: number; unitPriceMinor: number; lineTotalMinor: number; imageUrl: string | null }>;
  subtotalMinor: number;
  discountMinor?: number;
  totalMinor: number;
  shippingMinor: number;
  loyalty: { expectedPoints: number; egpValueMinor: number | null; pointsPerEgp: number; egpPerPoint: number | null };
  expiresAt: string;
  completedAt: string | null;
  orderNumber: string | null;
  orderStatus?: string;
}

export function getGroundReview(token: string, signal?: AbortSignal) {
  return apiFetch<GroundReview>(`/orders/ground/review/${encodeURIComponent(token)}`, { cache: 'no-store', signal });
}

export async function getGroundReviewContact(token: string, signal?: AbortSignal) {
  const contact = await apiFetch<unknown>(
    `/orders/ground/review/${encodeURIComponent(token)}/contact`,
    { cache: 'no-store', signal },
  );
  if (!validContact(contact)) throw new Error('Invalid signup contact response');
  return contact;
}

export function claimGroundReview(token: string) {
  return apiFetch<{ claimed: true; orderId: string; orderNumber: string; points: number }>(`/orders/ground/review/${encodeURIComponent(token)}/claim`, { method: 'POST', auth: true });
}
