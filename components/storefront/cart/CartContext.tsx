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
  apiGetCart,
  apiAddItem,
  apiUpdateItem,
  apiRemoveItem,
  apiClearCart,
  getCartSessionId,
} from '@/lib/api/cart';
import { getAccessToken } from '@/lib/auth/tokens';

// ── Public types ──────────────────────────────────────────────────────────────

export type CartItem = CartItemDto;

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
  addItem: (variantId: string, qty: number) => Promise<void>;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function hydrateCart() {
    // Skip API call for unidentified guests — backend would 401 and we'd
    // hammer it on every reload. The cart is created lazily on first add.
    if (!getAccessToken() && !getCartSessionId()) return;
    try {
      const data = await apiGetCart();
      setCart(data);
    } catch {
      // No cart yet — keep empty default.
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async function addItem(variantId: string, qty: number): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      setCart(await apiAddItem(variantId, qty));
    } catch (e) {
      setError(extractErrorMessage(e, 'Failed to add item'));
    } finally {
      setLoading(false);
    }
  }

  async function updateQty(itemId: string, qty: number): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      setCart(await apiUpdateItem(itemId, qty));
    } catch (e) {
      setError(extractErrorMessage(e, 'Failed to update quantity'));
    } finally {
      setLoading(false);
    }
  }

  async function removeItem(itemId: string): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      setCart(await apiRemoveItem(itemId));
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
    openDrawer: () => setDrawerOpen(true),
    closeDrawer: () => setDrawerOpen(false),
    addItem,
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
    if (typeof err['message'] === 'string') return err['message'];
    if (typeof err['error'] === 'string') return err['error'];
  }
  return fallback;
}
