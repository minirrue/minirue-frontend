/**
 * cart — API layer
 * All price amounts are decimal strings (e.g. "210.00") matching backend Dinero output.
 */

import { apiFetch } from './client';

// ── Response shapes ──────────────────────────────────────────────────────────

export interface CartItemDto {
  id: string;
  variantId: string;
  qty: number;
  unitPriceAmount: string;
  unitPriceCurrency: string;
  lineTotalAmount: string;
  // Optional enrichment fields (resolved by frontend from catalog)
  name?: string;
  brand?: string;
  sizeMl?: number;
  bottleType?: string;
  cloudinaryPublicId?: string;
  altText?: string;
}

export interface CartTotals {
  subtotalAmount: string;
  currency: string;
  itemCount: number;
  uniqueItemCount: number;
}

export interface CartDto {
  id: string;
  status: string;
  currency: string;
  items: CartItemDto[];
  totals: CartTotals;
  expiresAt: string | null;
}

// ── Session cookie ────────────────────────────────────────────────────────────

export const CART_SESSION_COOKIE = 'mr-cart-session';

export function getCartSessionId(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${CART_SESSION_COOKIE}=`));
  return match ? match.split('=')[1] : null;
}

export function setCartSessionId(id: string): void {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${CART_SESSION_COOKIE}=${id}; path=/; SameSite=Lax; expires=${expires}`;
}

export function clearCartSessionId(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${CART_SESSION_COOKIE}=; Max-Age=0; path=/`;
}

/** Guest carts require x-session-id; create one before the first API call. */
export function ensureCartSessionId(): string {
  const existing = getCartSessionId();
  if (existing) return existing;
  const id = crypto.randomUUID();
  setCartSessionId(id);
  return id;
}

// ── API calls ─────────────────────────────────────────────────────────────────

function sessionHeaders(): HeadersInit {
  const sid = getCartSessionId() ?? ensureCartSessionId();
  return { 'x-session-id': sid };
}

const EMPTY_CART: CartDto = {
  id: '',
  status: 'ACTIVE',
  currency: 'EGP',
  items: [],
  totals: { subtotalAmount: '0.00', currency: 'EGP', itemCount: 0, uniqueItemCount: 0 },
  expiresAt: null,
};

export { EMPTY_CART };

export async function apiGetCart(): Promise<CartDto> {
  return apiFetch<CartDto>('/cart', { auth: true, headers: sessionHeaders() });
}

export async function apiAddItem(variantId: string, qty: number): Promise<CartDto> {
  ensureCartSessionId();
  return apiFetch<CartDto>('/cart/items', {
    method: 'POST',
    auth: true,
    headers: sessionHeaders(),
    body: JSON.stringify({ variantId, qty }),
  });
}

/** Merge guest session cart into the authenticated user cart (BR-CART-006). */
export async function apiMergeCart(): Promise<CartDto> {
  return apiFetch<CartDto>('/cart/merge', {
    method: 'POST',
    auth: true,
    headers: sessionHeaders(),
  });
}

export async function apiUpdateItem(itemId: string, qty: number): Promise<CartDto> {
  return apiFetch<CartDto>(`/cart/items/${itemId}`, {
    method: 'PATCH',
    auth: true,
    headers: sessionHeaders(),
    body: JSON.stringify({ qty }),
  });
}

export async function apiRemoveItem(itemId: string): Promise<CartDto> {
  return apiFetch<CartDto>(`/cart/items/${itemId}`, {
    method: 'DELETE',
    auth: true,
    headers: sessionHeaders(),
  });
}

export async function apiClearCart(): Promise<void> {
  await apiFetch<void>('/cart', { method: 'DELETE', auth: true, headers: sessionHeaders() });
}
