/**
 * Persists display metadata for cart line items (backend returns variantId only).
 * Written when adding from a product page; merged on every cart hydrate.
 */

import type { CartDto, CartItemDto } from '@/lib/api/cart';

const STORAGE_KEY = 'mr-cart-enrich-v1';

export interface VariantEnrichment {
  name?: string;
  brand?: string;
  sizeMl?: number;
  bottleType?: string;
  cloudinaryPublicId?: string;
  altText?: string;
}

function readMap(): Record<string, VariantEnrichment> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, VariantEnrichment>;
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, VariantEnrichment>): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // quota exceeded — non-fatal
  }
}

export function cacheVariantEnrichment(variantId: string, data: VariantEnrichment): void {
  const map = readMap();
  map[variantId] = { ...map[variantId], ...data };
  writeMap(map);
}

export function applyEnrichmentToCart(cart: CartDto): CartDto {
  const map = readMap();
  if (!cart.items.length) return cart;

  const items: CartItemDto[] = cart.items.map((item) => {
    const extra = map[item.variantId];
    if (!extra) return item;
    return { ...item, ...extra };
  });

  return { ...cart, items };
}
