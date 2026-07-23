import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import HomePageClient from './HomePageClient';
import { getQueryClient } from '@/lib/hooks/query-client';
import { storefrontHomeQueryOptions, storefrontChromeQueryOptions } from '@/lib/hooks/use-storefront';

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
