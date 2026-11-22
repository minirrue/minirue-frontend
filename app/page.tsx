import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import HomePageClient from './HomePageClient';
import { getQueryClient } from '@/lib/hooks/query-client';
import { storefrontHomeQueryOptions, storefrontChromeQueryOptions } from '@/lib/hooks/use-storefront';

/**
 * The home page at 5 minutes, explicitly.
 *
 * The root layout now asks for the shop settings (favicon) with an hour's
 * revalidate, and a route inherits the shortest revalidate in its tree, so
 * without this line the shop front — the page whose hero and tiles change —
 * would go stale for an hour. Five minutes is the same freshness the whole
 * site had before, and the client polls `/storefront/home` and `/chrome`
 * every 15-30s, so a save still shows up on an open page immediately.
 */
export const revalidate = 300;

export default async function HomePage() {
  const queryClient = getQueryClient();

  // Blocking prefetch — first paint and SEO need real content in the initial
  // HTML. The client then reads through `useStorefrontHome`/`useStorefrontChrome`
  // (lib/hooks/use-storefront.ts) so polling and the SSE live-update invalidation
  // (components/providers/StorefrontLiveUpdates.tsx) actually re-render the page
  // without a reload — a plain server-fetched prop would not do that.
  await Promise.all([
    queryClient.prefetchQuery(storefrontHomeQueryOptions()),
    queryClient.prefetchQuery(storefrontChromeQueryOptions()),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HomePageClient />
    </HydrationBoundary>
  );
}
