'use client';

import Header from '@/components/layout/Header';

export default function HeaderWrapper() {
  return <Header onOpenCart={() => {}} cartCount={0} transparent={false} />;
}
