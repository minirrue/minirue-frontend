'use client';

import React from 'react';
import SplashScreen from '@/components/storefront/SplashScreen';
import HomeView from '@/components/storefront/HomeView';
import Header from '@/components/layout/Header';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Footer from '@/components/layout/Footer';
import ChatButton from '@/components/chat/ChatButton';
import ChatPanel from '@/components/chat/ChatPanel';
import type { ApiProduct } from '@/lib/api/catalog';
import { useRouter } from 'next/navigation';
import { useCart } from '@/components/storefront/cart/CartContext';

interface Props {
  products: ApiProduct[];
}

export default function HomePageClient({ products }: Props) {
  const router = useRouter();
  const [showSplash, setShowSplash] = React.useState(true);
  const [chatOpen, setChatOpen] = React.useState(false);
  const { itemCount, openDrawer } = useCart();

  const goToProduct = (product: ApiProduct) => {
    router.push(`/products/${product.slug}`);
  };

  return (
    <>
      {showSplash && (
        <SplashScreen onComplete={() => setShowSplash(false)} />
      )}

      <div className="mr-page-sheet">
        <AnnouncementBar />
        <Header
          onOpenCart={openDrawer}
          cartCount={itemCount}
          transparent
        />

        <HomeView products={products} onSelect={goToProduct} />
      </div>

      <Footer />

      <ChatButton onClick={() => setChatOpen((o) => !o)} />
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  );
}
