import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/hooks';
import { storefrontHomeQueryOptions, storefrontChromeQueryOptions } from '@/lib/hooks';
import StorefrontLiveClient from './StorefrontLiveClient';

/**
 * Server Component: prefetches the resolved home + chrome queries into a request-scoped
 * QueryClient and dehydrates that state into the HTML. The client tree below hydrates from it
 * (first paint is server-rendered, no client refetch needed on mount) and then
 * `useStorefrontHome` / `useStorefrontChrome` take over live polling.
 */
export default async function StorefrontLivePage() {
  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery(storefrontHomeQueryOptions()),
    queryClient.prefetchQuery(storefrontChromeQueryOptions()),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <StorefrontLiveClient />
    </HydrationBoundary>
  );
}
