'use client';

import Header from '@/components/layout/Header';
import { useStorefrontChrome } from '@/lib/hooks/use-storefront';
import { FALLBACK_CHROME } from '@/lib/api/storefront';

export default function HeaderWrapper() {
  const { data: chrome } = useStorefrontChrome();
  return (
    <Header
      navbar={chrome?.navbar ?? FALLBACK_CHROME.navbar}
      onOpenCart={() => {}}
      cartCount={0}
      transparent={false}
    />
  );
}
