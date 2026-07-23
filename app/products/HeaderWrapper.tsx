'use client';

import Header from '@/components/layout/Header';
import { useStorefrontChrome } from '@/lib/hooks/use-storefront';
import { FALLBACK_CHROME } from '@/lib/api/storefront';
import { useCart } from '@/components/storefront/cart/CartContext';

/**
 * The header for every non-home storefront page (products, brands, categories,
 * standalone pages). It used to pass `onOpenCart={() => {}}` — a no-op — so the
 * cart button did nothing anywhere except the home page. Wired to the real cart
 * drawer (which lives in the root layout) via useCart, with the live count.
 */
export default function HeaderWrapper() {
  const { data: chrome } = useStorefrontChrome();
  const { openDrawer, itemCount } = useCart();
  return (
    <Header
      navbar={chrome?.navbar ?? FALLBACK_CHROME.navbar}
      onOpenCart={openDrawer}
      cartCount={itemCount}
      transparent={false}
    />
  );
}
