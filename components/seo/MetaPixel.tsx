'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { META_PIXEL_ID } from '@/lib/analytics/meta-pixel';
import { TIKTOK_PIXEL_ID } from '@/lib/analytics/tiktok-pixel';
import { isAdsOff } from '@/lib/analytics/ads-off';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/**
 * Meta and TikTok PageViews on client-side navigation. Their base codes live
 * in <head> and count the first hard load. Skip the first render here to avoid
 * double-counting it, then report subsequent route changes to both pixels.
 *
 * Uses useSearchParams, so it must stay inside the telemetry <Suspense> in
 * app/layout.tsx.
 */
export default function MetaPixel(): null {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastRoute = useRef<string | null>(null);

  useEffect(() => {
    if (!META_PIXEL_ID && !TIKTOK_PIXEL_ID) return;
    const route = `${pathname}?${searchParams.toString()}`;
    if (lastRoute.current === null) {
      lastRoute.current = route;
      return;
    }
    if (lastRoute.current === route) return;
    lastRoute.current = route;
    if (META_PIXEL_ID) window.fbq?.('track', 'PageView');
    if (TIKTOK_PIXEL_ID && !isAdsOff()) window.ttq?.page?.();
  }, [pathname, searchParams]);

  return null;
}
