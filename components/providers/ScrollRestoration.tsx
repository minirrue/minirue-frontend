'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useLenis } from 'lenis/react';

/**
 * A new page starts at the top; going back returns you to where you were.
 *
 * Neither happened here, and the reason is Lenis. It takes over the root
 * scroller, so the browser's own scroll restoration and Next's scroll-to-top
 * both act on a scroll position Lenis is not reading from — the new page
 * rendered with Lenis still holding the previous page's offset. Opening a
 * product from halfway down a listing dropped you halfway down the product page
 * (owner, 2026-08-21: "when i tap on page to open or product it makes me scroll
 * in middle or bottom which is bad ui").
 *
 * Taking `scrollRestoration` to `manual` is deliberate rather than incidental:
 * leaving it on `auto` means the browser ALSO restores, a frame or two later,
 * against that same stale native offset — so a correct restore visibly jumps a
 * second time. Owning it outright is the only way the two cannot disagree.
 *
 * Keyed on pathname only, NOT on search params. A filter or sort change is a
 * search-param change on the page you are already reading, and yanking the
 * shopper to the top when they tick "in stock" would be its own bug.
 */
export default function ScrollRestoration() {
  const pathname = usePathname();
  const lenis = useLenis();

  /** Scroll offset per pathname, for this tab only. */
  const positions = React.useRef<Map<string, number>>(new Map());
  /** The entry currently on screen, so we know what to save against. */
  const currentKey = React.useRef<string | null>(null);
  /** Set by popstate, consumed by the pathname effect below. */
  const isPop = React.useRef(false);

  React.useEffect(() => {
    if (typeof window === 'undefined' || !('scrollRestoration' in history)) return;
    const previous = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    return () => {
      history.scrollRestoration = previous;
    };
  }, []);

  // A back/forward gesture fires popstate BEFORE React re-renders for the new
  // route, so the flag is already set by the time the pathname effect runs.
  React.useEffect(() => {
    const onPop = () => {
      isPop.current = true;
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Record where we are, continuously, against the entry we are on. Reading
  // Lenis's own value rather than window.scrollY — they diverge mid-animation,
  // and Lenis's is the one that will be restored.
  React.useEffect(() => {
    if (!lenis) return;
    const onScroll = () => {
      if (currentKey.current) {
        positions.current.set(currentKey.current, lenis.scroll);
      }
    };
    lenis.on('scroll', onScroll);
    return () => lenis.off('scroll', onScroll);
  }, [lenis]);

  React.useEffect(() => {
    if (!lenis || !pathname) return;

    const restoring = isPop.current;
    isPop.current = false;
    currentKey.current = pathname;

    const target = restoring ? (positions.current.get(pathname) ?? 0) : 0;

    /**
     * `immediate` — never animate this.
     *
     * A smooth scroll to the top of a page the shopper has not seen yet is a
     * visible rewind of content they never scrolled through, and on a restore
     * it animates past everything between here and where they were. Both should
     * simply be the starting position.
     *
     * Two frames, not one. The first lands before the new route has painted its
     * full height, so a restore to a deep offset clamps to whatever the page
     * measured at that instant; the second runs once layout has settled and
     * lands on the real number. `scrollTo(0)` is idempotent, so a forward
     * navigation just does the same harmless thing twice.
     */
    const jump = () => lenis.scrollTo(target, { immediate: true, force: true });
    jump();
    const raf = requestAnimationFrame(() => requestAnimationFrame(jump));
    return () => cancelAnimationFrame(raf);
  }, [lenis, pathname]);

  return null;
}
