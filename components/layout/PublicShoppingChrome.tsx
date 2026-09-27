'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/** Review has its own focused layout; shopping overlays would cover the receipt. */
export default function PublicShoppingChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return pathname.startsWith('/booth/review/') ? null : children;
}
