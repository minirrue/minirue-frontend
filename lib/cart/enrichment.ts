/**
 * Persists display metadata for cart line items (backend returns variantId only).
 * Written when adding from a product page; merged on every cart hydrate.
 */

import type { CartDto, CartItemDto } from '@/lib/api/cart';

const STORAGE_KEY = 'mr-cart-enrich-v1';

/**
 * localStorage, not sessionStorage — the cart outlives the tab.
 *
 * `mr-cart-session` is a 30-day cookie, so a bag survives closing the browser.
 * This cache did not: it lived in sessionStorage, so the shopper who added
 * something on Monday and came back on Tuesday found a bag where NOTHING had
 * a name or a picture, because the only place a cart line's display copy ever
 * existed was a store that had just been wiped. That is half of #56 — the raw
 * `Variant #<uuid>` was the fallback firing, and it fired every new tab.
 *
 * The cost of the longer life is staleness: a product renamed in the dashboard
 * keeps its old label in one shopper's bag until they add it again. That is a
 * much smaller harm than a database identifier where the product name goes,
 * and it disappears entirely the day `GET /v1/cart` returns a name of its own
 * (see lib/api/cart.ts).
 */
const LEGACY_SESSION_KEY = STORAGE_KEY;

export interface VariantEnrichment {
  name?: string;
  brand?: string;
  sizeMl?: number;
  bottleType?: string;
  cloudinaryPublicId?: string;
  // Gallery-linked media's already-resolved URL (see MediaAsset.url in
  // lib/api/catalog.ts) — takes priority over cloudinaryPublicId when
  // building the cart line item's image (see CartItemRow.tsx).
  imageUrl?: string;
  altText?: string;
  /**
   * The parent product id. The cart API's CartItemDto carries variantId only
   * (see lib/api/cart.ts), so this is the one place a productId for a cart
   * line can come from — cached at add-time and merged back onto the item by
   * applyEnrichmentToCart() below. Analytics (add_to_cart, remove_from_cart,
   * cart_qty_change — see CartContext.tsx) all key off this; a line added
   * without it simply cannot emit those events, which is preferable to
   * emitting one with a fabricated productId.
   */
  productId?: string;
}

function parse(raw: string | null): Record<string, VariantEnrichment> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, VariantEnrichment>;
  } catch {
    return {};
  }
}

function readMap(): Record<string, VariantEnrichment> {
  if (typeof window === 'undefined') return {};
  try {
    // The session copy is read too so a bag filled before this change keeps
    // its names for the rest of that visit, rather than going blank at the
    // moment of the deploy. It is never written to again.
    return { ...parse(sessionStorage.getItem(LEGACY_SESSION_KEY)), ...parse(localStorage.getItem(STORAGE_KEY)) };
  } catch {
    // Private browsing, or storage disabled entirely.
    return {};
  }
}

function writeMap(map: Record<string, VariantEnrichment>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
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
