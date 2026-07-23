'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8002') + '/v1';

/**
 * Opens an `EventSource` to `GET /v1/storefront/events` and, on a
 * `storefront.updated` message, invalidates the `storefront` query keys so
 * TanStack refetches `home`/`chrome` and the page re-renders with no reload.
 *
 * `invalidateQueries({ queryKey: ['storefront'] })` is a deliberate partial
 * match — TanStack invalidates every query whose key starts with the given
 * array, so this matches `useStorefrontHome()`/`useStorefrontChrome()`
 * (`lib/hooks/use-storefront.ts`) regardless of the exact suffix they use,
 * the same convention `lib/hooks/queries.ts` already follows for `['catalog', ...]`.
 *
 * Renders nothing. Mounted once, high in the tree, in `app/layout.tsx`.
 * Failure is harmless by design: if the stream never connects (or the
 * browser doesn't support `EventSource`), the page keeps working on the
 * polling `lib/hooks/use-storefront.ts` also does — this is a latency
 * improvement on top of that, not a replacement for it. `EventSource`
 * reconnects on its own after a drop; we don't add our own retry loop, only
 * a listener cleanup on unmount.
 */
export default function StorefrontLiveUpdates() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return;
    }

    let source: EventSource | null = null;
    try {
      source = new EventSource(`${BASE}/storefront/events`);
    } catch {
      // Construction itself can throw in some environments (e.g. blocked by
      // an extension/proxy) — the page must keep working on polling alone.
      return;
    }

    const handleUpdate = () => {
      void queryClient.invalidateQueries({ queryKey: ['storefront'] });
    };

    source.addEventListener('storefront.updated', handleUpdate);
    // Deliberately no `onerror` retry logic — EventSource reconnects on its
    // own, and a poll fallback already covers the gap while it does.

    return () => {
      source?.removeEventListener('storefront.updated', handleUpdate);
      source?.close();
    };
  }, [queryClient]);

  return null;
}
