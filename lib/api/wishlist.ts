import { apiFetch } from './client';
import type { ApiProduct } from './catalog';

/**
 * Saved products. Everything here is scoped to the signed-in customer by their
 * cookie — no route takes a customer id, so there is nothing to tamper with.
 */

export async function apiGetWishlistIds(): Promise<string[]> {
  const res = await apiFetch<{ productIds: string[] }>(
    '/customers/me/wishlist?ids=1',
  );
  return Array.isArray(res?.productIds) ? res.productIds : [];
}

export async function apiGetWishlistProducts(): Promise<ApiProduct[]> {
  const res = await apiFetch<{ items: ApiProduct[] }>('/customers/me/wishlist');
  return Array.isArray(res?.items) ? res.items : [];
}

/** One call for one tap — no read-then-decide-then-write race on a double-tap. */
export async function apiToggleWishlist(
  productId: string,
): Promise<{ saved: boolean }> {
  return apiFetch(`/customers/me/wishlist/${productId}/toggle`, {
    method: 'POST',
  });
}
