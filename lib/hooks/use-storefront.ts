// No 'use client' directive: `storefrontHomeQueryOptions`/`storefrontChromeQueryOptions` must
// be callable from a Server Component for SSR prefetch (see app/dev-storefront-live/page.tsx and
// `lib/hooks/queries.ts` for the established convention). `useQuery` itself only requires being
// *called* from within a client component tree, not that this module carry the directive.

import { queryOptions, useQuery } from '@tanstack/react-query';
import {
  fetchStorefrontChrome,
  fetchStorefrontHome,
  type ResolvedChrome,
  type ResolvedHome,
} from '@/lib/api/storefront';

/**
 * Live-updating storefront read layer.
 *
 * The global `QueryClient` default (`lib/hooks/query-client.ts`) sets `staleTime: 5m`, which is
 * right for catalog data but far too stale for admin-authored home-page content: the shop owner
 * requirement is that a shopper already on the page sees a save WITHOUT refreshing.
 *
 * The backend caches `/storefront/home` and `/storefront/chrome` for 60s server-side but busts
 * that cache the instant an admin saves (see minirue-backend storefront module). So a poll that
 * lands after a save always gets fresh data immediately — the only cost of polling is wasted
 * requests between saves, not staleness.
 *
 * Chosen intervals:
 *   - `staleTime: 15_000`      — a refetch triggered by focus/reconnect/mount within 15s of the
 *                                last successful one is skipped as redundant. Short enough that
 *                                a shopper switching tabs and back sees near-live content, long
 *                                enough to no-op the common case of rapid remounts/tab flips.
 *   - `refetchInterval: 30_000` — the steady-state poll. Content here changes "a few times a
 *                                week" per the shop owner, not every few seconds, so this is
 *                                about picking a worst-case latency (≤30s to see a save) rather
 *                                than chasing real-time. At 30s a busy shop with thousands of
 *                                concurrently open tabs adds ~2 req/min/tab to two endpoints
 *                                the backend already caches for 60s — cheap relative to catalog
 *                                traffic, and never faster than the backend's own cache window,
 *                                so it can never out-pace what the backend is willing to serve
 *                                fresh.
 *   - `refetchOnWindowFocus: true` / `refetchOnReconnect: true` — catches the common "admin
 *                                saved while I was on another tab" case immediately instead of
 *                                waiting out the interval.
 *   - `refetchIntervalInBackground` left at its v5 default (`false`) — a backgrounded/hidden tab
 *                                stops polling entirely and picks back up (via refetchOnWindowFocus)
 *                                the moment it's foregrounded, so a shop with many idle tabs open
 *                                doesn't hammer the API for content nobody is looking at.
 */

const STOREFRONT_LIVE_STALE_TIME = 15_000;
const STOREFRONT_LIVE_REFETCH_INTERVAL = 30_000;

export const storefrontHomeQueryOptions = () =>
  queryOptions({
    queryKey: ['storefront', 'home'] as const,
    queryFn: (): Promise<ResolvedHome> => fetchStorefrontHome(),
    staleTime: STOREFRONT_LIVE_STALE_TIME,
    refetchInterval: STOREFRONT_LIVE_REFETCH_INTERVAL,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

export const storefrontChromeQueryOptions = () =>
  queryOptions({
    queryKey: ['storefront', 'chrome'] as const,
    queryFn: (): Promise<ResolvedChrome> => fetchStorefrontChrome(),
    staleTime: STOREFRONT_LIVE_STALE_TIME,
    refetchInterval: STOREFRONT_LIVE_REFETCH_INTERVAL,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

/** Live-polling read of the resolved home page (sections + announcement). */
export function useStorefrontHome() {
  return useQuery(storefrontHomeQueryOptions());
}

/** Live-polling read of the resolved chrome (navbar, footer, favicon, announcement). */
export function useStorefrontChrome() {
  return useQuery(storefrontChromeQueryOptions());
}
