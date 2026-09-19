'use client';

/**
 * Product-page micro-behaviour capture (minirue-dashboard#121 / #90 S10):
 * section dwell time, idle "pause" while a product is on screen, and the
 * Meta-compatible `ProductEngaged` custom event. Batched through the
 * existing `track()` queue/flush (lib/analytics/track.ts) — nothing here
 * opens its own network connection.
 *
 * Deliberately NOT in this file, and not implemented anywhere in this slice:
 * desktop-screenshot detection (PrintScreen), generic clipboard-copy capture
 * of page text, and `contextmenu` capture on product images. The owner asked
 * for these in the #121 thread; they were left out on purpose — see the PR/
 * issue comment for why. Nothing below listens for `keyup`, `copy`, or
 * `contextmenu`.
 */
import * as React from 'react';
import { track } from './track';
import { trackMetaCustomEvent } from './meta-pixel';
import { currentScrollDepthPct } from './page-tracking';

/** Idle threshold for the `attention_pause` event — "pause ≥ 8s" per #121. */
export const IDLE_PAUSE_MS = 8000;
/** Meta's own engagement bar: 20s in view OR 75% scroll on the product page. */
export const PRODUCT_ENGAGED_SECONDS = 20;
export const PRODUCT_ENGAGED_SCROLL_PCT = 75;

/**
 * Accumulates visible time for one section across possibly-multiple
 * enter/leave spans (a shopper can scroll a section in and out of view more
 * than once per visit). Pure — no DOM, no timers of its own; the caller
 * supplies `now` so this is trivially unit-testable.
 */
export class DwellAccumulator {
  private enteredAt: number | null = null;
  private totalMs = 0;

  /** Marks the section as having become visible. A second `enter` while
   * already entered is a no-op — IntersectionObserver can report the same
   * state twice in a row, and this must not double-count. */
  enter(now: number): void {
    if (this.enteredAt !== null) return;
    this.enteredAt = now;
  }

  /** Ends the current visible span (if any) and returns the running total —
   * does NOT reset it, so repeated `leave` calls are safe/idempotent. */
  leave(now: number): number {
    if (this.enteredAt !== null) {
      this.totalMs += Math.max(0, now - this.enteredAt);
      this.enteredAt = null;
    }
    return this.totalMs;
  }

  /** `leave` plus a reset — the shape a "send on leave" reporter wants: get
   * the total for what just ended, then start counting the next span at 0. */
  flush(now: number): number {
    const total = this.leave(now);
    this.totalMs = 0;
    return total;
  }
}

/** Whole seconds, floored at 0 — the wire shape `section_dwell`/`attention_pause` carry. */
export function roundDwellSeconds(ms: number): number {
  return Math.max(0, Math.round(ms / 1000));
}

/**
 * Fire-once-per-key gate. Used for anything that should happen at most once
 * per product view (e.g. `ProductEngaged`) without reaching for a React ref
 * at every call site — a plain, synchronous, framework-free primitive.
 */
export function createOnceGate<K = string>(): {
  shouldFire: (key: K) => boolean;
  reset: (key: K) => void;
} {
  const fired = new Set<K>();
  return {
    shouldFire(key: K): boolean {
      if (fired.has(key)) return false;
      fired.add(key);
      return true;
    },
    reset(key: K): void {
      fired.delete(key);
    },
  };
}

/** Whether accumulated attention on a product page crosses Meta's ProductEngaged bar. */
export function shouldFireProductEngaged(seconds: number, scrollPct: number): boolean {
  return seconds >= PRODUCT_ENGAGED_SECONDS || scrollPct >= PRODUCT_ENGAGED_SCROLL_PCT;
}

/**
 * Trailing-edge throttle: `fn` runs immediately on the first call, then at
 * most once per `ms` after that, always with the most recent arguments. Used
 * to keep high-frequency DOM events (scroll, mousemove) from flooding
 * analytics — never to delay or drop the FIRST call, which is usually the
 * one that matters most (e.g. "activity resumed").
 */
export function throttle<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number,
): (...args: A) => void {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: A | null = null;

  return (...args: A) => {
    const now = Date.now();
    const remaining = ms - (now - last);
    if (remaining <= 0) {
      last = now;
      fn(...args);
      return;
    }
    pendingArgs = args;
    if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        last = Date.now();
        const toSend = pendingArgs;
        pendingArgs = null;
        if (toSend) fn(...toSend);
      }, remaining);
    }
  };
}

const ACTIVITY_EVENTS = ['scroll', 'mousemove', 'keydown', 'touchstart', 'wheel'] as const;

/**
 * Section dwell (image / description / reviews): tracks visible time via
 * IntersectionObserver and reports it via `track('section_dwell', …)` when
 * the section leaves view, the tab is hidden, or the page unloads — never as
 * a running total while still on screen.
 */
export function useSectionDwell(
  ref: React.RefObject<Element | null>,
  opts: { productId: string; section: 'image' | 'description' | 'reviews'; enabled?: boolean },
): void {
  const { productId, section, enabled = true } = opts;

  React.useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || typeof IntersectionObserver === 'undefined') return;

    const acc = new DwellAccumulator();
    const flush = () => {
      const seconds = roundDwellSeconds(acc.flush(Date.now()));
      // Sub-second glances are noise, not "dwell" — and would otherwise fire
      // on every scroll-past.
      if (seconds >= 1) track('section_dwell', { productId, section, seconds });
    };

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) acc.enter(Date.now());
        else flush();
      },
      { threshold: 0.5 },
    );
    io.observe(el);

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', flush);

    return () => {
      flush();
      io.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', flush);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, section, enabled]);
}

/**
 * "Pause" — idle ≥ IDLE_PAUSE_MS while the watched element is on screen.
 * Fires once per idle span; any activity re-arms it for the next one, so a
 * long visit can report several pauses, never a stream of them.
 */
export function useIdlePause(
  ref: React.RefObject<Element | null>,
  opts: { productId: string; thresholdMs?: number; enabled?: boolean },
): void {
  const { productId, thresholdMs = IDLE_PAUSE_MS, enabled = true } = opts;

  React.useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || typeof IntersectionObserver === 'undefined') return;

    let visible = false;
    let armed = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const clear = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
    const arm = () => {
      clear();
      if (!visible) return;
      timer = setTimeout(() => {
        if (!armed) return;
        armed = false;
        track('attention_pause', { productId, seconds: Math.round(thresholdMs / 1000) });
      }, thresholdMs);
    };
    const onActivity = throttle(() => {
      armed = true;
      arm();
    }, 500);

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        visible = entry.isIntersecting;
        if (visible) arm();
        else clear();
      },
      { threshold: 0.5 },
    );
    io.observe(el);

    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, onActivity, { passive: true }));

    return () => {
      clear();
      io.disconnect();
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, onActivity));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, thresholdMs, enabled]);
}

/**
 * `ProductEngaged` — Meta custom event, fired at most once per mount
 * (i.e. once per product view) the moment cumulative visible time or scroll
 * depth crosses the bar. `eventId` should be the same id used for any
 * CAPI-side mirror of this event (#112), so Meta can dedupe.
 */
export function useProductEngaged(productId: string, eventId: string): void {
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    let fired = false;
    let seconds = 0;

    const tick = () => {
      if (fired || document.visibilityState !== 'visible') return;
      seconds += 1;
      if (shouldFireProductEngaged(seconds, currentScrollDepthPct())) {
        fired = true;
        trackMetaCustomEvent(
          'ProductEngaged',
          { content_ids: [productId], content_type: 'product' },
          eventId,
        );
      }
    };
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [productId, eventId]);
}
