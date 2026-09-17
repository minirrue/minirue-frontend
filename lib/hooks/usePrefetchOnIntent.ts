'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

/**
 * Prefetch a route the moment the shopper shows INTENT, not when it scrolls
 * into view.
 *
 * Why not just `prefetch` on the Link: every shop route is dynamic (see
 * ShopRouteSkeleton for why), and `prefetch={true}` on a dynamic route fetches
 * the FULL RSC payload. On a 24-card grid that is 24 full page payloads fired
 * the instant the grid enters the viewport — which would make the listing
 * itself slower to help a tap that may never come.
 *
 * Intent is cheap and almost as early. A pointer entering a card, or a finger
 * touching it, precedes the navigation by 100–300ms — long enough for the
 * payload to be warm by the time the tap completes, and it only ever fires for
 * cards the shopper actually reaches for.
 *
 * `touchstart` matters more than hover here: this shop's traffic is phones, and
 * there is no hover on a phone. It fires before `click`, so the prefetch and
 * the navigation overlap rather than queue.
 *
 * Fires once per href. `router.prefetch` is idempotent and cheap to call again,
 * but a grid card can emit pointerenter repeatedly as a finger drags across it,
 * and there is no reason to ask twice.
 */
export function usePrefetchOnIntent(href: string | null | undefined) {
  const router = useRouter();
  const done = React.useRef<string | null>(null);
  const [idlePrefetchEnabled, setIdlePrefetchEnabled] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    let idleId: number | null = null;
    let fallbackId: ReturnType<typeof setTimeout> | null = null;

    const enablePrefetch = () => {
      if (!cancelled) setIdlePrefetchEnabled(true);
    };

    const scheduleWhenIdle = () => {
      if (typeof window.requestIdleCallback === 'function') {
        idleId = window.requestIdleCallback(enablePrefetch, { timeout: 2_000 });
      } else {
        fallbackId = setTimeout(enablePrefetch, 0);
      }
    };

    if (document.readyState === 'complete') scheduleWhenIdle();
    else window.addEventListener('load', scheduleWhenIdle, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener('load', scheduleWhenIdle);
      if (idleId !== null) window.cancelIdleCallback(idleId);
      if (fallbackId !== null) clearTimeout(fallbackId);
    };
  }, []);

  return React.useMemo(() => {
    const prefetch = () => {
      if (!href || done.current === href) return;
      done.current = href;
      try {
        router.prefetch(href);
      } catch {
        // Prefetching is an optimisation. A failure here must never surface —
        // the tap still works, it is just not warm.
      }
    };
    return {
      // `false` is essential: event handlers alone do not stop Next's own
      // viewport observer. Restore the framework's default (`null`) only once
      // the load event and an idle slice have both passed, outside the LCP
      // window. Intent above remains available throughout the critical load.
      prefetch: idlePrefetchEnabled ? null : false,
      onPointerEnter: prefetch,
      onTouchStart: prefetch,
      onFocus: prefetch,
    };
  }, [href, idlePrefetchEnabled, router]);
}
