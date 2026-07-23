'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import HomeView from '@/components/storefront/HomeView';
import Header from '@/components/layout/Header';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Footer from '@/components/layout/Footer';
import ChatButton from '@/components/chat/ChatButton';
import ChatPanel from '@/components/chat/ChatPanel';
import type { ApiProduct } from '@/lib/api/catalog';
import { FALLBACK_CHROME } from '@/lib/api/storefront';
import type { ResolvedHome } from '@/lib/api/storefront';
import { useStorefrontHome, useStorefrontChrome } from '@/lib/hooks/use-storefront';
import { useCart } from '@/components/storefront/cart/CartContext';

const EMPTY_HOME: ResolvedHome = {
  sections: [],
  announcement: { enabled: false, messages: [], linkUrl: null, background: null },
};

export default function HomePageClient() {
  const router = useRouter();
  const [chatOpen, setChatOpen] = React.useState(false);
  const { itemCount, openDrawer } = useCart();

  // The server already prefetched and dehydrated these queries (app/page.tsx),
  // so this hydrates from SSR data on first paint, then keeps polling/SSE
  // (lib/hooks/use-storefront.ts, StorefrontLiveUpdates) so an open tab
  // reflects an admin's save without a reload.
  const { data: home = EMPTY_HOME } = useStorefrontHome();
  const { data: chrome = FALLBACK_CHROME } = useStorefrontChrome();

  const goToProduct = (product: ApiProduct) => {
    router.push(`/products/${product.slug}`);
  };

  return (
    <>
      <div className="mr-page-sheet">
        <AnnouncementBar
          messages={chrome.announcement.messages}
          enabled={chrome.announcement.enabled}
          linkUrl={chrome.announcement.linkUrl}
          background={chrome.announcement.background}
        />
        <Header navbar={chrome.navbar} onOpenCart={openDrawer} cartCount={itemCount} transparent />
        <HomeView home={home} onSelect={goToProduct} />
      </div>

      <Footer config={chrome.footer} />

      <ChatButton onClick={() => setChatOpen((o) => !o)} />
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  );
}
