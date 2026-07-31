'use client';

import React from 'react';
import { MessageLoading } from '@/components/ui/message-loading';
import { usePageNavigationLoading } from '@/lib/navigation/usePageNavigationLoading';

/**
 * Task 43 (2026-07-31) — "page loader for 1-2s navigation delay", narrowed
 * by the owner to "here its between pages only navigation back or forth".
 *
 * Mounted ONCE, persistently, in `app/layout.tsx` (the storefront merge is
 * now resolved, so this file is safe to edit directly). It stays in the DOM
 * for its whole visible lifetime rather than being a Suspense fallback that
 * Next unmounts the instant content is ready — that is what makes a REAL
 * fade-OUT possible: a node removed from the DOM cannot play a CSS
 * transition on its own removal, but a node whose `opacity` THIS component
 * controls can transition smoothly in both directions.
 *
 * What decides "navigating": `usePageNavigationLoading()` — covers a
 * `<Link>` click AND the browser Back/Forward/swipe-back, and deliberately
 * does NOT cover an in-page filter/search/tab/modal change (none of those
 * change the pathname). See that hook for why `useLinkStatus` alone or a
 * plain `loading.tsx` Suspense boundary can't do both halves of this at
 * once — this app had exactly that draft and it silently missed Back.
 *
 * Phases, not a single boolean, are what make BOTH the show-delay and the
 * fade-out real:
 *   hidden  → nothing in the DOM at all (a fast nav that resolves inside
 *             `delayMs` never renders anything — not invisible, ABSENT).
 *   visible → `opacity: 1`, faded in over `FADE_MS`.
 *   leaving → `opacity: 0`, still mounted for `FADE_MS` so the fade-out
 *             actually plays, then unmounts.
 */
const SHOW_DELAY_MS = 200;
const FADE_MS = 250; // matches --mr-dur-normal in mr-tokens.css

type Phase = 'hidden' | 'visible' | 'leaving';

export default function PageLoader({ delayMs = SHOW_DELAY_MS }: { delayMs?: number }) {
  const navigating = usePageNavigationLoading();
  const [phase, setPhase] = React.useState<Phase>('hidden');

  React.useEffect(() => {
    let showTimer: ReturnType<typeof setTimeout> | null = null;
    let leaveTimer: ReturnType<typeof setTimeout> | null = null;

    if (navigating) {
      showTimer = setTimeout(() => setPhase('visible'), delayMs);
    } else {
      setPhase((current) => {
        if (current === 'visible') {
          leaveTimer = setTimeout(() => setPhase('hidden'), FADE_MS);
          return 'leaving';
        }
        // Was still waiting out the show-delay when navigation finished —
        // a fast nav. Cancel outright; it was never shown.
        return 'hidden';
      });
    }

    return () => {
      if (showTimer) clearTimeout(showTimer);
      if (leaveTimer) clearTimeout(leaveTimer);
    };
  }, [navigating, delayMs]);

  if (phase === 'hidden') return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      data-testid="page-loader"
      data-trace-id="PG-STOREFRONT-GLOBAL::EL-REGION-page-loader"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        display: 'grid',
        placeItems: 'center',
        pointerEvents: phase === 'visible' ? 'auto' : 'none',
        opacity: phase === 'visible' ? 1 : 0,
        transition: `opacity ${FADE_MS}ms var(--mr-ease-out)`,
        // Same warm-cream surface as the rest of the shop chrome
        // (mr-tokens.css --mr-bg-raised), at partial opacity so the outgoing
        // page reads as "paused underneath", never replaced by a blank screen.
        background: 'color-mix(in srgb, var(--mr-bg-raised) 88%, transparent)',
        backdropFilter: 'blur(2px)',
      }}
    >
      <MessageLoading />
    </div>
  );
}
