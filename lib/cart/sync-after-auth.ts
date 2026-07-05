/**
 * Sync cart after auth — merges guest session cart when present.
 */
import { apiMergeCart, getCartSessionId } from '@/lib/api/cart';

export async function syncCartAfterAuth(): Promise<void> {
  if (getCartSessionId()) {
    try {
      await apiMergeCart();
    } catch {
      // merge is best-effort; cart context will re-hydrate on sync event
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('mr-cart-sync'));
  }
}
