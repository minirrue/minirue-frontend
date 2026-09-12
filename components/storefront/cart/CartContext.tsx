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
import { subtotalToMinor } from '@/lib/checkout/checkout-money';
import { groupBagLines, planSetQty, type BagLine, type BundleIndex } from './bag-lines';
import { primeBundleIndex, useBundleIndex } from './use-bundle-catalog';

// ── Public types ──────────────────────────────────────────────────────────────

export type CartItem = CartItemDto;
export type { BagLine };

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
  /** The raw API rows — one per variant, sets expanded. */
  items: CartItem[];
  /**
   * The bag as a customer reads it: one entry per product or per whole set.
   *
   * Every screen that SHOWS the bag renders this; `items` is for the callers
   * that genuinely want variant rows (checkout, analytics). See bag-lines.ts
   * for why the two differ.
   */
  lines: BagLine[];
  /** The sets in the bag, by id — needed to price a bag honestly (#56). */
  bundleIndex: BundleIndex;
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
  /**
   * Change the quantity of one bag line.
   *
   * Takes a LINE, not an item id, because for a set the quantity is not a
   * property of any single row: it is "how many of these sets", and applying
   * it means writing `qty × unitsPerSet` to every member. Handing this an
   * item id was how a shopper could put one half of a set to 3 and leave the
   * other at 1.
   */
  setLineQty: (line: BagLine, qty: number) => Promise<void>;
  /** Remove a whole line — for a set, every member of it. */
  removeLine: (line: BagLine) => Promise<void>;
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

  /**
   * Only asked for when the bag actually holds a set — an ordinary bag of
   * products never pays for the request.
   */
  const hasBundle = cart.items.some((i) => !!i.bundleId);
  const bundleIndex = useBundleIndex(hasBundle);
  const lines = React.useMemo(
    () => groupBagLines(cart.items, bundleIndex),
    [cart.items, bundleIndex],
  );

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
    // Raced against the add, not queued behind it: the drawer opens the moment
    // this resolves, and it needs the set's NAME, which lives in a different
    // endpoint (see use-bundle-catalog.ts).
    primeBundleIndex();
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

  /**
   * Apply a plan of row writes, then adopt the LAST cart the server returned.
   *
   * Sequential rather than parallel: every one of these endpoints returns the
   * whole cart, and firing them at once would leave which response lands last
   * — and therefore what the bag shows — up to the network.
   */
  async function applyWrites(
    writes: ReturnType<typeof planSetQty>,
    failureMessage: string,
  ): Promise<boolean> {
    if (!writes.length) return true;
    setLoading(true);
    setError(null);
    try {
      let data: CartDto | null = null;
      for (const write of writes) {
        data =
          write.op === 'patch'
            ? await apiUpdateItem(write.itemId, write.qty)
            : await apiRemoveItem(write.itemId);
      }
      if (data) setCartFromApi(data);
      return true;
    } catch (e) {
      setError(extractErrorMessage(e, failureMessage));
      // A plan can be several calls; a failure part-way through means what is
      // on screen no longer describes what the server holds. Re-read rather
      // than leave a half-applied bag standing.
      void hydrateCart();
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function setLineQty(line: BagLine, qty: number): Promise<void> {
    // Read before the mutation — this is the last point the previous
    // quantity (for `delta`) and the cached productId are certainly still in
    // state.
    const previous = line.items[0] as EnrichedItem | undefined;
    const ok = await applyWrites(
      planSetQty(line, qty),
      qty === 0 ? 'Failed to remove item' : 'Failed to update quantity',
    );
    if (!ok) return;

    /**
     * A set has no single productId, so it fires no per-product event — the
     * same rule this file already follows for a line with nothing cached, and
     * better than nominating one of its members as "the" product.
     */
    if (line.kind !== 'item' || !previous?.productId) return;
    if (qty === 0) {
      track('remove_from_cart', {
        productId: previous.productId,
        variantId: previous.variantId,
        qty: previous.qty,
        priceMinor: subtotalToMinor(previous.unitPriceAmount),
      });
    } else {
      track('cart_qty_change', {
        productId: previous.productId,
        variantId: previous.variantId,
        qty,
        delta: qty - line.qty,
      });
    }
  }

  async function removeLine(line: BagLine): Promise<void> {
    await setLineQty(line, 0);
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
    lines,
    bundleIndex,
    subtotalAmount: cart.totals.subtotalAmount,
    currency: cart.currency,
    /**
     * Things in the bag, not cart rows.
     *
     * `totals.itemCount` is the server's sum of every row's qty, and a set is
     * stored as one row per member — so adding one two-piece set made the
     * header badge say 2 and the bag say "YOUR BAG · 2" for a single thing the
     * shop sells as a single thing (#56, verbatim from the report). Counting
     * bag lines is what the shopper would count, and it is still 0 exactly
     * when the bag is empty, which is what every `itemCount === 0` guard
     * actually asks.
     */
    itemCount: lines.reduce((n, l) => n + l.qty, 0),
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
    setLineQty,
    removeLine,
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
