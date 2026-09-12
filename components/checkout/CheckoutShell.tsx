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
      {/* Curtain layer — BEFORE the sheet on purpose: both are positioned with
          `z-index: auto`, so document order alone decides which paints on top.
          See components/layout/Footer.tsx. */}
      <Footer config={chrome?.footer ?? FALLBACK_CHROME.footer} shopName={chrome?.shopName} />

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
    </>
  );
}
