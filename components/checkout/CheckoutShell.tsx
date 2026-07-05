'use client';

import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useCart } from '@/components/storefront/cart/CartContext';
import { usePublicStorefront } from '@/lib/hooks/usePublicStorefront';

interface Props {
  children: React.ReactNode;
}

export default function CheckoutShell({ children }: Props) {
  const { itemCount, openDrawer } = useCart();
  const { storefront, footerTagline } = usePublicStorefront();

  return (
    <>
      <div className="mr-page-sheet">
        <AnnouncementBar
          messages={storefront?.announcementMessages}
          enabled={storefront?.announcementEnabled ?? true}
          linkUrl={storefront?.announcementLinkUrl}
          background={storefront?.announcementBackground}
        />
        <Header onOpenCart={openDrawer} cartCount={itemCount} />
        {children}
      </div>
      <Footer tagline={footerTagline} />
    </>
  );
}
