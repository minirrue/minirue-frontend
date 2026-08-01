'use client';

/**
 * CartContext — global cart state + API actions.
 *
 * Guest carts: identified by x-session-id header (persisted in mr-cart-session cookie).
 * On login, client calls POST /v1/cart/merge with x-session-id to merge guest items.
 */

import React from 'react';
import {
  type CartDto,
  type CartItemDto,
  EMPTY_CART,
  apiAddBundle,
  apiGetCart,
  apiAddItem,
  apiUpdateItem,
  apiRemoveItem,
  apiClearCart,
  getCartSessionId,
} from '@/lib/api/cart';
import { isAuthenticated } from '@/lib/auth/tokens';
import { applyEnrichmentToCart, cacheVariantEnrichment, type VariantEnrichment } from '@/lib/cart/enrichment';
import { track } from '@/lib/analytics';
import { subtotalToMinor } from '@/lib/checkout/checkout-schemas';

// ── Public types ──────────────────────────────────────────────────────────────

export type CartItem = CartItemDto;

/** Where an add-to-cart action originated — carried on `add_to_cart` so the
 * source funnel (PDP main button vs. sticky bar vs. a list quick-add vs. the
 * drawer) can be told apart. */
export type CartEventSource = 'pdp' | 'list' | 'drawer' | 'sticky';

/**
 * `CartItemDto` only ever carries `variantId` (see lib/api/cart.ts) — the
 * productId analytics needs comes solely from cached enrichment
 * (lib/cart/enrichment.ts), merged onto the item by `applyEnrichmentToCart`.
 * A line with no cached productId (e.g. hydrated fresh with nothing ever
 * cached for that variant) simply cannot fire a cart analytics event for
 * itself — see the guards below.
 */
type EnrichedItem = CartItem & { productId?: string };

export interface CartContextValue {
  cartId: string;
  items: CartItem[];
  subtotalAmount: string;
  currency: string;
  itemCount: number;
  loading: boolean;
  error: string | null;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  addItem: (
    variantId: string,
    qty: number,
    enrichment?: VariantEnrichment,
    source?: CartEventSource,
  ) => Promise<void>;
  /** Add a whole set. Throws on failure so the page can say what went wrong. */
  addBundle: (slug: string) => Promise<void>;
  updateQty: (itemId: string, qty: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  clearError: () => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const CartContext = React.createContext<CartContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = React.useState<CartDto>(EMPTY_CART);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  React.useEffect(() => {
    void hydrateCart();
    const onSync = () => {
      void hydrateCart();
    };
    window.addEventListener('mr-cart-sync', onSync);
    return () => window.removeEventListener('mr-cart-sync', onSync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setCartFromApi(data: CartDto) {
    setCart(applyEnrichmentToCart(data));
  }

  async function hydrateCart() {
    // Skip API call for unidentified guests — session is created on first add.
    if (!isAuthenticated() && !getCartSessionId()) return;
    try {
      setCartFromApi(await apiGetCart());
    } catch {
      // No cart yet — keep empty default.
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async function addItem(
    variantId: string,
    qty: number,
    enrichment?: VariantEnrichment,
    source: CartEventSource = 'pdp',
  ): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      if (enrichment) {
        cacheVariantEnrichment(variantId, enrichment);
      }
      const data = await apiAddItem(variantId, qty);
      setCartFromApi(data);
      // Fired only once the API call has actually succeeded — a failed add is
      // not an add, and counting it would inflate the add-to-cart rate.
      const productId = enrichment?.productId;
      const added = data.items.find((i) => i.variantId === variantId);
      if (productId && added) {
        track('add_to_cart', {
          productId,
          variantId,
          qty,
          priceMinor: subtotalToMinor(added.unitPriceAmount),
          source,
        });
      }
    } catch (e) {
      setError(extractErrorMessage(e, 'Failed to add item'));
    } finally {
      setLoading(false);
    }
  }

  /**
   * Unlike `addItem`, this RE-THROWS.
   *
   * A set can fail for a reason the shopper needs to read — a member sold out
   * between the page rendering and the button being pressed. Swallowing it into
   * the shared `error` state would leave the bundle page looking like nothing
   * happened, since that state is rendered by the cart drawer, not by it.
   */
  async function addBundle(slug: string): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const data = await apiAddBundle(slug);
      setCartFromApi(data);
      setDrawerOpen(true);
    } catch (e) {
      const message = extractErrorMessage(e, 'Failed to add this set');
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }

  async function updateQty(itemId: string, qty: number): Promise<void> {
    // Read before the mutation — this is the last point the previous
    // quantity (for `delta`) and the cached productId are certainly still in
    // state.
    const previous = cart.items.find((i) => i.id === itemId) as EnrichedItem | undefined;
    setLoading(true);
    setError(null);
    try {
      setCartFromApi(await apiUpdateItem(itemId, qty));
      if (previous?.productId) {
        track('cart_qty_change', {
          productId: previous.productId,
          variantId: previous.variantId,
          qty,
          delta: qty - previous.qty,
        });
      }
    } catch (e) {
      setError(extractErrorMessage(e, 'Failed to update quantity'));
    } finally {
      setLoading(false);
    }
  }

  async function removeItem(itemId: string): Promise<void> {
    const previous = cart.items.find((i) => i.id === itemId) as EnrichedItem | undefined;
    setLoading(true);
    setError(null);
    try {
      setCartFromApi(await apiRemoveItem(itemId));
      if (previous?.productId) {
        track('remove_from_cart', {
          productId: previous.productId,
          variantId: previous.variantId,
          qty: previous.qty,
          priceMinor: subtotalToMinor(previous.unitPriceAmount),
        });
      }
    } catch (e) {
      setError(extractErrorMessage(e, 'Failed to remove item'));
      void hydrateCart();
    } finally {
      setLoading(false);
    }
  }

  async function clearCart(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      await apiClearCart();
      setCart({ ...EMPTY_CART, currency: cart.currency });
    } catch (e) {
      setError(extractErrorMessage(e, 'Failed to clear cart'));
    } finally {
      setLoading(false);
    }
  }

  const value: CartContextValue = {
    cartId: cart.id,
    items: cart.items,
    subtotalAmount: cart.totals.subtotalAmount,
    currency: cart.currency,
    itemCount: cart.totals.itemCount,
    loading,
    error,
    drawerOpen,
    openDrawer: () => {
      setDrawerOpen(true);
      track('cart_drawer_open', {});
    },
    closeDrawer: () => setDrawerOpen(false),
    addItem,
    addBundle,
    updateQty,
    removeItem,
    clearCart,
    clearError: () => setError(null),
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCart(): CartContextValue {
  const ctx = React.useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}

// ── Internal ──────────────────────────────────────────────────────────────────

function extractErrorMessage(e: unknown, fallback: string): string {
  if (typeof e === 'object' && e !== null) {
    const err = e as Record<string, unknown>;
    const message = err['message'];
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) {
      const parts = message
        .map((m) => {
          if (typeof m === 'string') return m;
          if (typeof m === 'object' && m !== null && 'issue' in m) {
            return String((m as { issue: unknown }).issue);
          }
          return null;
        })
        .filter(Boolean);
      if (parts.length) return parts.join('. ');
    }
    if (typeof err['error'] === 'string') return err['error'];
  }
  return fallback;
}
