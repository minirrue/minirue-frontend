'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Task 43 (2026-07-31), owner clarification: "here its between pages only
 * navigation back or forth" — the loader is for going from one PAGE to
 * another, in EITHER direction, and nothing else. Two failure modes to
 * avoid, both explicitly called out:
 *
 * 1. It must not fire for in-page state — a data refetch, a filter change,
 *    the cart drawer, a modal, infinite scroll, a tab switch. None of those
 *    change the pathname, so this hook — keyed on pathname, never on the
 *    full URL — never reports loading for them.
 * 2. It must fire for Back/Forward (and a mobile swipe-back), not only a
 *    forward `<Link>` click. `useLinkStatus` alone cannot do this — it only
 *    reports the pending state of one clicked Link, and Back never clicks
 *    one. This hook instead watches TWO signals that between them cover
 *    every way a client-side route change can start:
 *      - `history.pushState`/`replaceState`, patched once, which Next's App
 *        Router calls the instant it starts a `<Link>` or `router.push`/
 *        `replace` transition — well before the destination has rendered.
 *      - `popstate`, which fires for Back/Forward and swipe-back — neither
 *        of which touches pushState/replaceState at all (the browser
 *        already owns that history entry).
 *
 * "Done" is `usePathname()` actually changing. A `pushState`/`replaceState`
 * call whose URL only changes the search string or hash (a filter, a page
 * link within the same route) is filtered out at the patch site itself —
 * before/after `window.location.pathname` is compared, and the loading flag
 * is never set for it — so requirement 1 holds even for a filter UI that
 * happens to use `router.push`.
 *
 * A single navigation cannot show the loader twice: this is a boolean, not
 * a counter. Whichever signal fires first sets it true; the next real
 * pathname change sets it false. A second signal firing for the same
 * in-flight navigation (should not happen — Link clicks don't fire
 * `popstate` and Back doesn't call `pushState`) would just be a no-op
 * `setState(true)` on an already-true value.
 */
type NavigationListener = () => void;

let historyPatched = false;
const navigationListeners = new Set<NavigationListener>();

function notifyNavigationStarted(): void {
  navigationListeners.forEach((listener) => listener());
}

function patchHistoryOnce(): void {
  if (historyPatched || typeof window === 'undefined') return;
  historyPatched = true;

  const originalPushState = window.history.pushState.bind(window.history);
  const originalReplaceState = window.history.replaceState.bind(window.history);

  window.history.pushState = function patchedPushState(
    ...args: Parameters<History['pushState']>
  ) {
    const before = window.location.pathname;
    const result = originalPushState(...args);
    if (window.location.pathname !== before) notifyNavigationStarted();
    return result;
  } as History['pushState'];

  window.history.replaceState = function patchedReplaceState(
    ...args: Parameters<History['replaceState']>
  ) {
    const before = window.location.pathname;
    const result = originalReplaceState(...args);
    if (window.location.pathname !== before) notifyNavigationStarted();
    return result;
  } as History['replaceState'];
}

export function usePageNavigationLoading(): boolean {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const previousPathnameRef = useRef(pathname);
  const lastKnownPathnameRef = useRef(
    typeof window !== 'undefined' ? window.location.pathname : pathname,
  );

  useEffect(() => {
    patchHistoryOnce();

    const onNavigationStarted = () => setLoading(true);
    navigationListeners.add(onNavigationStarted);

    // Back/Forward/swipe-back: the browser has already updated
    // window.location by the time this fires, so compare against the last
    // pathname THIS hook actually committed to, never the raw event.
    const onPopState = () => {
      if (window.location.pathname !== lastKnownPathnameRef.current) {
        setLoading(true);
      }
    };
    window.addEventListener('popstate', onPopState);

    return () => {
      navigationListeners.delete(onNavigationStarted);
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  // The route committed. Only a real pathname change turns the loader off —
  // a page whose only change was searchParams keeps whatever `loading`
  // value it already had (which, per the guard above, was never set true
  // for a searchParams-only change in the first place).
  useEffect(() => {
    lastKnownPathnameRef.current = pathname;
    if (previousPathnameRef.current !== pathname) {
      previousPathnameRef.current = pathname;
      setLoading(false);
    }
  }, [pathname]);

  return loading;
}

/** Test-only: undo the module-level history patch between test files. */
export function __resetHistoryPatchForTests(): void {
  historyPatched = false;
  navigationListeners.clear();
}
