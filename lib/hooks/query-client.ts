import { QueryClient, defaultShouldDehydrateQuery } from '@tanstack/react-query';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5m
        gcTime: 1000 * 60 * 10, // 10m (formerly cacheTime)
        retry: 1,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      },
      mutations: {
        // NEVER retry a mutation. A write is not idempotent, so replaying one
        // whose response was merely lost performs it twice.
        //
        // This is what duplicated customer addresses: POST /addresses inserted
        // the row, the response failed to arrive, React Query replayed it — and
        // because addAddress clears the existing default before inserting, the
        // second attempt demoted the first row and inserted another. The
        // customer saw an error and ended up with the same address twice, one
        // default and one not.
        retry: 0,
      },
      dehydrate: {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
      },
    },
  });
}

let clientSingleton: QueryClient | undefined;

export function getQueryClient() {
  if (typeof window === 'undefined') {
    return createQueryClient();
  }
  if (!clientSingleton) {
    clientSingleton = createQueryClient();
  }
  return clientSingleton;
}
