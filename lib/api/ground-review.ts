import { apiFetch } from './client';

export interface GroundReview {
  status: 'AWAITING_PAYMENT' | 'COMPLETED' | 'EXPIRED';
  salesMode: 'GROUND' | 'ONLINE';
  currency: 'EGP';
  items: Array<{ variantId: string; name: string; sku: string; sizeMl: number | null; quantity: number; unitPriceMinor: number; lineTotalMinor: number; imageUrl: string | null }>;
  subtotalMinor: number;
  totalMinor: number;
  shippingMinor: number;
  loyalty: { expectedPoints: number; egpValueMinor: number | null; pointsPerEgp: number; egpPerPoint: number | null };
  expiresAt: string;
  completedAt: string | null;
  orderNumber: string | null;
}

export function getGroundReview(token: string, signal?: AbortSignal) {
  return apiFetch<GroundReview>(`/orders/ground/review/${encodeURIComponent(token)}`, { cache: 'no-store', signal });
}

export function claimGroundReview(token: string) {
  return apiFetch<{ claimed: true; orderId: string; orderNumber: string; points: number }>(`/orders/ground/review/${encodeURIComponent(token)}/claim`, { method: 'POST', auth: true });
}
