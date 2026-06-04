'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import type { ApiProduct, ProductVariant } from '@/lib/api/catalog';
import ApiProductDetail from '@/components/storefront/ApiProductDetail';
import Header from '@/components/layout/Header';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Footer from '@/components/layout/Footer';
import ChatButton from '@/components/chat/ChatButton';
import ChatPanel from '@/components/chat/ChatPanel';
import { useCart } from '@/components/storefront/cart/CartContext';

interface Props {
  slug: string;
  apiProductJson: string;
}

export default function ProductPageClient({ slug, apiProductJson }: Props) {
  const router = useRouter();
  const [chatOpen, setChatOpen] = React.useState(false);
  const { itemCount, openDrawer, addItem } = useCart();

  const product: ApiProduct = React.useMemo(
    () => JSON.parse(apiProductJson) as ApiProduct,
    [apiProductJson],
  );

  const handleAddToBag = async (variant: ProductVariant) => {
    await addItem(variant.id, 1);
    openDrawer();
  };

  return (
    <>
      <div className="mr-page-sheet">
        <AnnouncementBar />
        <Header
          onOpenCart={openDrawer}
          cartCount={itemCount}
          transparent={false}
        />
        <ApiProductDetail
          product={product}
          onBack={() => router.push('/products')}
          onAddToBag={handleAddToBag}
        />
      </div>

      <Footer />

      <ChatButton onClick={() => setChatOpen((o) => !o)} />
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  );
}
