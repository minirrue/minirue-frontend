'use client';

/**
 * useScrollDirection — the single scroll listener behind the top-bar /
 * bottom-bar show-hide choreography (W4a.2).
 *
 * `Header.tsx` used to attach its own unthrottled `scroll` listener just to
 * compute a boolean ("has the page scrolled past 60px"). Adding a second,
 * separate raw listener for the new bottom nav would double that cost on
 * every frame. Instead this hook is the ONE listener — behind
 * `requestAnimationFrame` so a fast scroll only samples once per paint — and
 * both `Header` and `MobileBottomNav` call it independently. Each call
 * subscribes its own rAF-throttled listener (two listeners, not zero), but
 * both are cheap and rAF-coalesced; the win over the old code is throttling,
 * not listener count.
 *
 * `y` is exposed too so Header can retire its bespoke `scrolled` state
 * (`scrollY > 60`) and derive it from this same subscription rather than
 * keeping a second listener around for that alone.
 */

import React from 'react';

export interface ScrollDirectionState {
  /** Which way the page last moved by more than `threshold` px. */
  direction: 'up' | 'down';
  /** True within a few px of the very top — direction is meaningless there. */
  atTop: boolean;
  /**
   * True within a few px of the very bottom of the document (Task 15a).
   * Reaching the end of a page is itself a downward scroll, so a bar gated
   * only on `direction === 'down'` is at its most visible exactly where it
   * covers the footer. Callers that hide on scroll-down should also hide at
   * `atBottom` so the footer is fully clear at max scroll.
   */
  atBottom: boolean;
  /** Current `window.scrollY`. */
  y: number;
}

const DEFAULT_THRESHOLD = 8;
/** Below this, we are "at the top" regardless of direction — matches the
 *  brief: "near the very top of the page, the top bar is always shown". */
const TOP_ZONE_PX = 4;
/** Same idea as `TOP_ZONE_PX`, mirrored at the other end of the page. */
const BOTTOM_ZONE_PX = 2;

const INITIAL_STATE: ScrollDirectionState = { direction: 'up', atTop: true, atBottom: false, y: 0 };

/**
 * `scrollHeight <= 0` means the document hasn't really been laid out (never
 * happens on a real page — only in a test/SSR environment with no layout
 * engine) — treat that as "not at the bottom" rather than let a zeroed
 * `scrollHeight` make every scroll position read as the bottom.
 */
function computeAtBottom(y: number): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false;
  const scrollHeight = document.documentElement.scrollHeight;
  if (scrollHeight <= 0) return false;
  return y + window.innerHeight >= scrollHeight - BOTTOM_ZONE_PX;
}

export function useScrollDirection(threshold = DEFAULT_THRESHOLD): ScrollDirectionState {
  const [state, setState] = React.useState<ScrollDirectionState>(INITIAL_STATE);
  const lastY = React.useRef(0);
  const rafId = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    lastY.current = window.scrollY;
    setState({
      direction: 'up',
      atTop: window.scrollY <= TOP_ZONE_PX,
      atBottom: computeAtBottom(window.scrollY),
      y: window.scrollY,
    });

    const sample = () => {
      rafId.current = null;
      const y = window.scrollY;
      const atTop = y <= TOP_ZONE_PX;
      const atBottom = computeAtBottom(y);

      if (atTop) {
        lastY.current = y;
        setState((prev) =>
          prev.atTop && prev.direction === 'up' && prev.y === y && prev.atBottom === atBottom
            ? prev
            : { direction: 'up', atTop: true, atBottom, y },
        );
        return;
      }

      const delta = y - lastY.current;
      if (Math.abs(delta) < threshold) {
        // Below threshold: direction doesn't flip, but keep `y` (and
        // `atBottom`) fresh so callers doing their own math (e.g. a fade tied
        // to scroll position) aren't stuck on a stale value.
        setState((prev) =>
          prev.y === y && prev.atBottom === atBottom ? prev : { ...prev, y, atBottom },
        );
        return;
      }

      const direction = delta > 0 ? 'down' : 'up';
      lastY.current = y;
      setState((prev) =>
        prev.direction === direction && !prev.atTop && prev.y === y && prev.atBottom === atBottom
          ? prev
          : { direction, atTop: false, atBottom, y },
      );
    };

    // A pending flag, set BEFORE requestAnimationFrame is called and cleared
    // only once it fires, guards re-entrancy without depending on `rafId.
    // current = requestAnimationFrame(...)`'s assignment completing before
    // the callback runs. On a real browser rAF is always async, so that
    // ordering is never observable — but a synchronous rAF (some test
    // environments' fake timers, some legacy polyfills) invokes `sample`
    // during the `requestAnimationFrame(sample)` call itself, which resets
    // `rafId.current` to null a statement BEFORE the still-pending
    // assignment overwrites it back to a non-null id, permanently wedging
    // this guard closed. `pending` cannot suffer that race: it is written
    // to `true` on the line directly before the call and only ever read/
    // cleared from inside `sample`, so there is no assignment left to race.
    const pending = { current: false };
    const onScroll = () => {
      if (pending.current) return;
      pending.current = true;
      rafId.current = requestAnimationFrame(() => {
        pending.current = false;
        sample();
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    };
  }, [threshold]);

  return state;
}
