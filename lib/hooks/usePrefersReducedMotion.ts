'use client';

import React from 'react';

/**
 * Does this reader want motion kept to a minimum?
 *
 * The same answer `useReducedMotion` from `motion/react` gives, without the
 * library. It was being imported into `ProductGallery` for this one boolean —
 * a ~56KB dependency for a media query.
 *
 * That mattered because of WHERE the gallery sits. The product page's LCP image
 * downloads while roughly 283KB of JavaScript is on the wire, and measured on a
 * throttled connection the image's transfer takes 1806ms against the ~390ms its
 * 78KB would suggest. The image is not slow; it is sharing a 1.6 Mbps pipe with
 * everything else (minirue-frontend#7). Every KB removed from that window is
 * bandwidth the largest element on the page gets back.
 *
 * ## Why `useSyncExternalStore`
 *
 * The naive version — `useState` seeded from `matchMedia` in an effect — is
 * wrong twice on a server-rendered page: it renders once with the wrong answer
 * and flashes, and `matchMedia` does not exist during SSR at all. This subscribes
 * to the query and reads it synchronously on the client, with an explicit server
 * snapshot.
 *
 * `false` is the right server snapshot even though it is the less cautious
 * answer: the markup must match what the client renders first, and the client's
 * first paint uses the real value. Returning `true` on the server would make
 * every animated page hydrate-mismatch for readers who have not set the
 * preference, which is nearly everyone.
 *
 * ## `addEventListener` with a fallback
 *
 * Safari below 14 exposes only `addListener` on a MediaQueryList. The fallback
 * is three lines and avoids an exception on a browser some shoppers still carry.
 */
const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mql = window.matchMedia(QUERY);

  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }
  // Safari < 14.
  mql.addListener(onChange);
  return () => mql.removeListener(onChange);
}

function getSnapshot(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(QUERY).matches;
}

/** Matches the server's markup, so the first paint never mismatches. */
function getServerSnapshot(): boolean {
  return false;
}

export function usePrefersReducedMotion(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
