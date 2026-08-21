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
      onPointerEnter: prefetch,
      onTouchStart: prefetch,
      onFocus: prefetch,
    };
  }, [href, router]);
}
