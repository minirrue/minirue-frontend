'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { track } from './track';

const SCROLL_THRESHOLDS = [25, 50, 75, 100] as const;

function currentScrollDepthPct(): number {
  if (typeof document === 'undefined') return 0;
  const doc = document.documentElement;
  const scrollable = doc.scrollHeight - doc.clientHeight;
  if (scrollable <= 0) return 100;
  const pct = (window.scrollY / scrollable) * 100;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

/**
 * Fires `page_view` on mount and on every `usePathname()` change,
 * `page_leave` (dwell ms + max scroll depth) whenever the page changes or the
 * tab is actually closed, and `scroll_depth` once per threshold per page.
 *
 * Mount this ONCE, high in the tree (AnalyticsProvider) — `usePathname()`
 * already reacts to client-side navigation, so mounting it per-route would
 * double-fire.
 */
export function usePageTracking(): void {
  const pathname = usePathname();
  // Real value assigned inside the effect below, before it is ever read —
  // calling Date.now() here (during render) would be an impure render.
  const enteredAt = useRef<number>(0);
  const maxScroll = useRef<number>(0);
  const firedThresholds = useRef<Set<number>>(new Set());
  const previousPath = useRef<string | null>(null);

  useEffect(() => {
    if (previousPath.current !== null && previousPath.current !== pathname) {
      track('page_leave', {
        ms: Date.now() - enteredAt.current,
        maxScroll: maxScroll.current || undefined,
      });
    }

    previousPath.current = pathname;
    enteredAt.current = Date.now();
    maxScroll.current = 0;
    firedThresholds.current = new Set();

    track('page_view', {});

    function handleScroll(): void {
      const pct = currentScrollDepthPct();
      if (pct > maxScroll.current) maxScroll.current = pct;
      for (const threshold of SCROLL_THRESHOLDS) {
        if (pct >= threshold && !firedThresholds.current.has(threshold)) {
          firedThresholds.current.add(threshold);
          track('scroll_depth', { pct: threshold });
        }
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [pathname]);

  // Final page_leave when the document is actually torn down (tab close,
  // reload, real cross-origin navigation). `pagehide` does not fire on
  // client-side App Router navigation, so this never double-counts with the
  // effect above.
  useEffect(() => {
    function handlePageHide(): void {
      track('page_leave', {
        ms: Date.now() - enteredAt.current,
        maxScroll: maxScroll.current || undefined,
      });
    }
    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
  }, []);
}

/**
 * Not wired to a route automatically — this lane does not own
 * `app/not-found.tsx` (a later lane does). Call this from the storefront's
 * 404 page/component to record a `not_found` event.
 */
export function trackNotFound(path: string): void {
  track('not_found', { path });
}

/**
 * One-time `window.onerror` / `unhandledrejection` listener. Call once from
 * AnalyticsProvider on mount; returns a cleanup function.
 *
 * `js_error`'s registered shape (`lib/analytics/events.ts`) is
 * `{ message, stack?, source? }` — there is no separate `line` field, so the
 * line/column (when available) is folded into `message` rather than dropped.
 */
export function initErrorTracking(): () => void {
  if (typeof window === 'undefined') return () => {};

  function handleError(event: ErrorEvent): void {
    const location =
      event.lineno != null ? ` (line ${event.lineno}:${event.colno ?? 0})` : '';
    track('js_error', {
      message: `${String(event.message ?? 'Unknown error')}${location}`.slice(0, 500),
      source: event.filename || undefined,
      stack: event.error?.stack ? String(event.error.stack).slice(0, 500) : undefined,
    });
  }

  function handleRejection(event: PromiseRejectionEvent): void {
    const reason: unknown = event.reason;
    const message =
      reason instanceof Error ? reason.message : String(reason ?? 'Unhandled rejection');
    const stack = reason instanceof Error ? reason.stack : undefined;
    track('js_error', {
      message: message.slice(0, 500),
      stack: stack ? stack.slice(0, 500) : undefined,
    });
  }

  window.addEventListener('error', handleError);
  window.addEventListener('unhandledrejection', handleRejection);

  return () => {
    window.removeEventListener('error', handleError);
    window.removeEventListener('unhandledrejection', handleRejection);
  };
}
