/**
 * Unit tests — lib/analytics/product-engagement.ts (pure pieces only)
 * Covers: DwellAccumulator's enter/leave/flush accounting, rounding,
 * once-per-key gating, the ProductEngaged threshold, and throttle's
 * leading/trailing-edge behaviour. Does not exercise the React hooks —
 * those are DOM/IntersectionObserver wiring around this logic.
 */
import {
  DwellAccumulator,
  roundDwellSeconds,
  createOnceGate,
  shouldFireProductEngaged,
  throttle,
  IDLE_PAUSE_MS,
  PRODUCT_ENGAGED_SECONDS,
  PRODUCT_ENGAGED_SCROLL_PCT,
} from '@/lib/analytics/product-engagement';

describe('DwellAccumulator', () => {
  it('accumulates zero with no enter/leave', () => {
    const acc = new DwellAccumulator();
    expect(acc.leave(1000)).toBe(0);
  });

  it('accumulates the span between enter and leave', () => {
    const acc = new DwellAccumulator();
    acc.enter(1000);
    expect(acc.leave(4000)).toBe(3000);
  });

  it('sums multiple enter/leave spans (a section scrolled in and out repeatedly)', () => {
    const acc = new DwellAccumulator();
    acc.enter(0);
    acc.leave(1000); // +1000
    acc.enter(5000);
    acc.leave(7500); // +2500
    expect(acc.leave(99999)).toBe(3500);
  });

  it('a second enter() while already entered does not restart the span', () => {
    const acc = new DwellAccumulator();
    acc.enter(0);
    acc.enter(500); // ignored — still counts from 0
    expect(acc.leave(1000)).toBe(1000);
  });

  it('leave() without a matching enter() is a safe no-op', () => {
    const acc = new DwellAccumulator();
    acc.enter(0);
    acc.leave(1000);
    expect(acc.leave(5000)).toBe(1000); // unchanged — nothing open to close
  });

  it('flush() returns the total AND resets it for the next span', () => {
    const acc = new DwellAccumulator();
    acc.enter(0);
    expect(acc.flush(2000)).toBe(2000);
    acc.enter(2000);
    expect(acc.flush(3000)).toBe(1000); // only the new span, not 2000+1000
  });
});

describe('roundDwellSeconds', () => {
  it('rounds to the nearest whole second', () => {
    expect(roundDwellSeconds(1400)).toBe(1);
    expect(roundDwellSeconds(1600)).toBe(2);
  });

  it('never goes negative', () => {
    expect(roundDwellSeconds(-500)).toBe(0);
  });
});

describe('createOnceGate', () => {
  it('fires the first time for a key and never again', () => {
    const gate = createOnceGate<string>();
    expect(gate.shouldFire('p1')).toBe(true);
    expect(gate.shouldFire('p1')).toBe(false);
    expect(gate.shouldFire('p1')).toBe(false);
  });

  it('tracks keys independently', () => {
    const gate = createOnceGate<string>();
    expect(gate.shouldFire('p1')).toBe(true);
    expect(gate.shouldFire('p2')).toBe(true);
  });

  it('reset() allows a key to fire again', () => {
    const gate = createOnceGate<string>();
    gate.shouldFire('p1');
    gate.reset('p1');
    expect(gate.shouldFire('p1')).toBe(true);
  });
});

describe('shouldFireProductEngaged', () => {
  it('is false below both thresholds', () => {
    expect(shouldFireProductEngaged(PRODUCT_ENGAGED_SECONDS - 1, PRODUCT_ENGAGED_SCROLL_PCT - 1)).toBe(false);
  });

  it('fires at the seconds threshold regardless of scroll', () => {
    expect(shouldFireProductEngaged(PRODUCT_ENGAGED_SECONDS, 0)).toBe(true);
  });

  it('fires at the scroll threshold regardless of seconds', () => {
    expect(shouldFireProductEngaged(0, PRODUCT_ENGAGED_SCROLL_PCT)).toBe(true);
  });

  it('fires when both are crossed', () => {
    expect(shouldFireProductEngaged(999, 100)).toBe(true);
  });
});

describe('throttle', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('runs the first call immediately (leading edge)', () => {
    const fn = jest.fn();
    const throttled = throttle(fn, 500);
    throttled('a');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');
  });

  it('drops/coalesces calls inside the window into one trailing call', () => {
    const fn = jest.fn();
    const throttled = throttle(fn, 500);
    throttled('a');
    throttled('b');
    throttled('c');
    expect(fn).toHaveBeenCalledTimes(1); // only the leading 'a' so far

    jest.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('c'); // most recent args, not 'b'
  });

  it('allows a fresh call once the window has fully elapsed', () => {
    const fn = jest.fn();
    const throttled = throttle(fn, 500);
    throttled('a');
    jest.advanceTimersByTime(600);
    throttled('b');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('b');
  });
});

describe('constants', () => {
  it('IDLE_PAUSE_MS matches the #121 spec (≥ 8s)', () => {
    expect(IDLE_PAUSE_MS).toBe(8000);
  });
});
