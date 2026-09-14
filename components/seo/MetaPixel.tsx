'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { META_PIXEL_ID } from '@/lib/analytics/meta-pixel';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/**
 * Meta Pixel PageView on client-side navigation. The base code itself lives
 * in <head> in app/layout.tsx and fires PageView once, on the first hard
 * load; every later page here is a client-side navigation Meta would never
 * see, so this sends one per route change — skipping the first render, which
 * the base code already counted.
 *
 * Uses useSearchParams, so it must stay inside the telemetry <Suspense> in
 * app/layout.tsx.
 */
export default function MetaPixel(): null {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const firstRender = useRef(true);

  useEffect(() => {
    if (!META_PIXEL_ID) return;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.fbq?.('track', 'PageView');
  }, [pathname, searchParams]);

  return null;
}
