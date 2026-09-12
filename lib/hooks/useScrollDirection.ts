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
 *
 * WHAT "DIRECTION" HAS TO MEAN ON A PHONE (#51)
 * =============================================
 * This hook shipped with one symmetric 8px threshold, and the owner's report
 * was the predictable result: "the upper navbar on mobile flashes many times
 * under one second when sliding slowly". Measured on the production build with
 * a scripted thumb-drag (e2e/storefront/mobile-scroll-stability.spec.ts), one
 * slow 1400px traversal flipped the header's transform 99 times.
 *
 * Three things were wrong, and each needed its own answer:
 *
 *   1. THE THRESHOLD WAS SMALLER THAN A FINGER'S OWN NOISE. A Pixel 5 is ~70mm
 *      wide for 393 CSS px — about 5.6 CSS px per millimetre — so a 2mm thumb
 *      roll-back during a slow drag is ~11px. Anything under that reads normal
 *      hand tremor as a deliberate change of direction. Hiding now demands a
 *      decisive 56px (`DOWN_THRESHOLD_PX`); revealing stays eager at 24px
 *      (`UP_THRESHOLD_PX`) because a reader reaching for the nav wants it NOW,
 *      and one number could never serve both.
 *
 *   2. THE BASELINE FOLLOWED THE FINGER. The old code measured from the last
 *      point where a threshold was crossed, so during a sustained downward
 *      drag the baseline was never more than 8px behind the finger and ANY
 *      roll-back beat it. The anchor is now the EXTREME of the current run —
 *      the furthest point reached in the direction currently held — so a
 *      reversal is measured from how far the page has actually come, not from
 *      a baseline that has been creeping along behind it. This keeps (and in
 *      fact strengthens) the property the original was careful about: a
 *      sub-threshold sample never moves the anchor in the direction that makes
 *      flipping EASIER. While the direction is 'up' the anchor is the run's
 *      minimum, so downward creep cannot ratchet it and small forward
 *      movements still accumulate toward the down threshold, exactly as
 *      before.
 *
 *   3. THE BAR COULD BE ASKED TO REVERSE MID-ANIMATION. The transform runs a
 *      280ms transition (Header.tsx), so a flip inside that window is a visible
 *      stutter by construction. `FLIP_COOLDOWN_MS` is 320 — longer than the
 *      transition — and a flip refused by the cooldown is DEFERRED, not
 *      dropped: `sample` schedules itself to run again when the cooldown
 *      expires. That matters because scroll events stop the instant the finger
 *      lifts, so a dropped flip would leave the bar hidden with nothing left to
 *      wake it.
 *
 * And one thing that is not about the finger at all: on iOS Safari and Chrome
 * Android the browser toolbar collapses and expands during a scroll, which
 * changes `window.innerHeight` by 60-100px and shifts the scroll offset in the
 * same frame. That is not the reader moving the page. `sample` therefore
 * re-anchors and declines to judge direction on any frame where the viewport
 * height changed — the same instability that makes the footer curtain snap
 * (#50), handled here at its other end.
 */

import React from 'react';

export interface ScrollDirectionState {
  /** Which way the page last moved decisively — see the thresholds below. */
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

export interface ScrollDirectionOptions {
  /** Downward travel required to report 'down'. Deliberately large — see (1). */
  downThreshold?: number;
  /** Upward travel required to report 'up'. Deliberately small — see (1). */
  upThreshold?: number;
  /** Minimum ms between two direction changes. Must exceed the consumer's
   *  transition duration or the bar can be told to reverse mid-animation. */
  cooldownMs?: number;
}

/**
 * Hiding is destructive — it takes the nav off the screen — so it has to be
 * asked for clearly. 56px is roughly a centimetre of thumb travel on a phone:
 * unmistakably a scroll, and an order of magnitude past hand tremor.
 */
const DOWN_THRESHOLD_PX = 56;
/**
 * Revealing is restorative, so it is eager: 24px, about 4mm. Still comfortably
 * above the ~11px tremor floor, but reached within a frame or two of a real
 * upward flick (which moves 30-80px per frame).
 */
const UP_THRESHOLD_PX = 24;
/** Longer than Header's 280ms transform transition, on purpose. */
const FLIP_COOLDOWN_MS = 320;

/** Below this, we are "at the top" regardless of direction — matches the
 *  brief: "near the very top of the page, the top bar is always shown". */
const TOP_ZONE_PX = 4;
/** Same idea as `TOP_ZONE_PX`, mirrored at the other end of the page. */
const BOTTOM_ZONE_PX = 2;

const INITIAL_STATE: ScrollDirectionState = { direction: 'up', atTop: true, atBottom: false, y: 0 };

const now = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

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

/**
 * @param config Either an options object, or a single number for the legacy
 *   symmetric-threshold behaviour (`n` for both directions, no cooldown) —
 *   which is what the tests use to demonstrate the pre-fix strobe.
 */
export function useScrollDirection(
  config: number | ScrollDirectionOptions = {},
): ScrollDirectionState {
  const resolved =
    typeof config === 'number'
      ? { downThreshold: config, upThreshold: config, cooldownMs: 0 }
      : config;
  // Destructured to primitives BEFORE they reach the effect's dependency
  // array: every caller passes an object literal (or nothing, which defaults
  // to a fresh `{}`), so depending on the object itself would tear down and
  // re-subscribe the scroll listener on every single render.
  const downThreshold = resolved.downThreshold ?? DOWN_THRESHOLD_PX;
  const upThreshold = resolved.upThreshold ?? UP_THRESHOLD_PX;
  const cooldownMs = resolved.cooldownMs ?? FLIP_COOLDOWN_MS;

  const [state, setState] = React.useState<ScrollDirectionState>(INITIAL_STATE);
  /**
   * The extreme of the current run: the maximum `y` seen while heading down,
   * the minimum while heading up. NOT "the last position we sampled" — see
   * point (2) in the header comment for why that distinction is the whole fix.
   */
  const anchorY = React.useRef(0);
  const directionRef = React.useRef<'up' | 'down'>('up');
  /**
   * `-Infinity`, not 0, and not a companion "have we flipped yet" boolean: the
   * first flip must never be held back by the cooldown, and `now()` really can
   * read 0 (a fake clock in a test, a `performance.now` polyfilled from a
   * freshly-zeroed origin). A 0 sentinel makes that case indistinguishable from
   * "no flip yet" and silently lets a flip through mid-transition.
   */
  const lastFlipAt = React.useRef(Number.NEGATIVE_INFINITY);
  const lastViewportH = React.useRef(0);
  const rafId = React.useRef<number | null>(null);
  const recheckTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    anchorY.current = window.scrollY;
    directionRef.current = 'up';
    lastFlipAt.current = Number.NEGATIVE_INFINITY;
    lastViewportH.current = window.innerHeight;
    setState({
      direction: 'up',
      atTop: window.scrollY <= TOP_ZONE_PX,
      atBottom: computeAtBottom(window.scrollY),
      y: window.scrollY,
    });

    /** Keep `y`/`atBottom` fresh without touching `direction`. */
    const refreshOnly = (y: number, atBottom: boolean) =>
      setState((prev) => (prev.y === y && prev.atBottom === atBottom ? prev : { ...prev, y, atBottom }));

    const sample = () => {
      rafId.current = null;
      const y = window.scrollY;
      const atTop = y <= TOP_ZONE_PX;
      const atBottom = computeAtBottom(y);

      /*
       * The toolbar gate. A mobile browser collapsing or expanding its chrome
       * changes `innerHeight` and moves the scroll offset in the same frame;
       * that is the browser, not the reader, and judging direction from it is
       * how the bar ends up strobing at the exact moment the toolbar animates.
       * Re-anchor to wherever the page has landed and wait for a real move.
       * On desktop `innerHeight` is constant, so this branch never runs.
       */
      if (window.innerHeight !== lastViewportH.current) {
        lastViewportH.current = window.innerHeight;
        anchorY.current = y;
        refreshOnly(y, atBottom);
        return;
      }

      if (atTop) {
        anchorY.current = y;
        directionRef.current = 'up';
        setState((prev) =>
          prev.atTop && prev.direction === 'up' && prev.y === y && prev.atBottom === atBottom
            ? prev
            : { direction: 'up', atTop: true, atBottom, y },
        );
        return;
      }

      // Extend the current run if the page has gone further the way it was
      // already going. This only ever makes a reversal HARDER to claim.
      const held = directionRef.current;
      if (held === 'down') {
        if (y > anchorY.current) anchorY.current = y;
      } else if (y < anchorY.current) {
        anchorY.current = y;
      }

      // How far back from the run's extreme we now are, and how far back it
      // takes to count as having turned around.
      const travelBack = held === 'down' ? anchorY.current - y : y - anchorY.current;
      const required = held === 'down' ? upThreshold : downThreshold;

      if (travelBack < required) {
        // Below threshold: direction doesn't flip, but keep `y` (and
        // `atBottom`) fresh so callers doing their own math (e.g. a fade tied
        // to scroll position) aren't stuck on a stale value.
        refreshOnly(y, atBottom);
        return;
      }

      const elapsed = now() - lastFlipAt.current;
      if (elapsed < cooldownMs) {
        // Deferred, not dropped. Scroll events stop the moment the finger
        // lifts, so simply returning here could strand the bar off screen with
        // nothing left to wake it. Re-sample when the cooldown expires — the
        // page will still be where it is, and the flip will go through then.
        refreshOnly(y, atBottom);
        if (recheckTimer.current !== null) clearTimeout(recheckTimer.current);
        recheckTimer.current = setTimeout(() => {
          recheckTimer.current = null;
          sample();
        }, cooldownMs - elapsed);
        return;
      }

      const direction = held === 'down' ? 'up' : 'down';
      directionRef.current = direction;
      anchorY.current = y;
      lastFlipAt.current = now();
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
      if (recheckTimer.current !== null) {
        clearTimeout(recheckTimer.current);
        recheckTimer.current = null;
      }
    };
  }, [downThreshold, upThreshold, cooldownMs]);

  return state;
}
