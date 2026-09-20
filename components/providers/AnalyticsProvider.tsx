'use client';

import { useEffect } from 'react';
import { ANALYTICS_DISABLED, FLUSH_INTERVAL_MS } from '@/lib/analytics/config';
import { syncVisitorIdMirror } from '@/lib/analytics/attribution';
import { restoreSpill, spill } from '@/lib/analytics/queue';
import { flush, flushBeacon } from '@/lib/analytics/track';
import { usePageTracking, initErrorTracking } from '@/lib/analytics/page-tracking';
import { initUiClickTracking } from '@/lib/analytics/ui-click';
import { initWebVitals, reportWebVitalsOnHidden } from '@/lib/analytics/web-vitals';

/**
 * Installs every storefront analytics listener exactly once, starts the
 * flush timer, and drains anything a previous page/tab couldn't send.
 * Renders nothing.
 *
 * Mounted once, in app/layout.tsx, immediately after `<Analytics />`
 * (Vercel's unrelated deployment telemetry — see that file for why they're
 * both inside the same top-level `<Suspense>`).
 */
export default function AnalyticsProvider(): null {
  usePageTracking();

  useEffect(() => {
    if (ANALYTICS_DISABLED || typeof window === 'undefined') return;

    // Rescue path (backend#224 / frontend#188): copy the readable mr-vid-c
    // mirror into localStorage on every load, before anything else fires a
    // collect request, so a same-session flush already has it available if
    // the cookie is cleared mid-visit.
    syncVisitorIdMirror();
    restoreSpill();
    initWebVitals();
    const cleanupErrors = initErrorTracking();
    const cleanupClicks = initUiClickTracking();

    const timer = window.setInterval(() => {
      void flush();
    }, FLUSH_INTERVAL_MS);

    function handleVisibility(): void {
      if (document.visibilityState === 'hidden') {
        reportWebVitalsOnHidden();
        void flush();
      }
    }

    function handlePageHide(): void {
      reportWebVitalsOnHidden();
      flushBeacon();
      spill();
    }

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
      cleanupErrors();
      cleanupClicks();
    };
  }, []);

  return null;
}
