'use client';

import { useRouter } from 'next/navigation';
import HomeView from '@/components/storefront/HomeView';
import Header from '@/components/layout/Header';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Footer from '@/components/layout/Footer';
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

  // The header's light/transparent treatment only reads correctly on top of
  // a dark hero image. SectionRenderer drops a hero with no slides, so a
  // leading "hero" section with an empty slide list renders nothing — the
  // header would then float over the plain cream page with no dark backdrop.
  // Mirror that skip logic here so we only ask for transparency when a hero
  // will actually paint behind the header.
  const firstSection = home.sections[0];
  const heroLeadsPage =
    firstSection?.type === 'hero' && firstSection.slides.length > 0;

  return (
    <>
      <div className="mr-page-sheet">
        <AnnouncementBar
          messages={chrome.announcement.messages}
          enabled={chrome.announcement.enabled}
          linkUrl={chrome.announcement.linkUrl}
          background={chrome.announcement.background}
        />
        <Header
          navbar={chrome.navbar}
          onOpenCart={openDrawer}
          cartCount={itemCount}
          transparent={heroLeadsPage}
        />
        <HomeView home={home} onSelect={goToProduct} />
      </div>

      <Footer config={chrome.footer} />
    </>
  );
}
