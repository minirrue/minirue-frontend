'use client';

import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useCart } from '@/components/storefront/cart/CartContext';
import { usePublicStorefront } from '@/lib/hooks/usePublicStorefront';
import { useStorefrontChrome } from '@/lib/hooks/use-storefront';
import { FALLBACK_CHROME } from '@/lib/api/storefront';

interface Props {
  children: React.ReactNode;
}

export default function CheckoutShell({ children }: Props) {
  const { itemCount, openDrawer } = useCart();
  const { storefront } = usePublicStorefront();
  const { data: chrome } = useStorefrontChrome();

  return (
    <>
      <div className="mr-page-sheet">
        <AnnouncementBar
          messages={storefront?.announcementMessages}
          enabled={storefront?.announcementEnabled ?? true}
          linkUrl={storefront?.announcementLinkUrl}
          background={storefront?.announcementBackground}
        />
        <Header navbar={chrome?.navbar ?? FALLBACK_CHROME.navbar} onOpenCart={openDrawer} cartCount={itemCount} />
        {children}
      </div>

      {/* The footer band — AFTER the page sheet, which is where it was before
          September and where the DOM should read it: the page first, its
          footer last. It is ordered UNDER the page by `z-index: -1` resolved
          inside `.mr-app-layer` (app/layout.tsx), not by being moved ahead of
          the page in document order the way #48 did. See
          components/layout/Footer.tsx. */}
      <Footer config={chrome?.footer ?? FALLBACK_CHROME.footer} shopName={chrome?.shopName} />
    </>
  );
}
