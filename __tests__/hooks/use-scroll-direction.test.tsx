import React from 'react';
import { render, act } from '@testing-library/react';
import { useScrollDirection } from '@/lib/hooks/useScrollDirection';

/**
 * #51 — "the upper navbar on mobile flashes many times under one second when
 * sliding slowly the webpage".
 *
 * These tests are the unit-level half of the proof; the other half is
 * e2e/storefront/mobile-scroll-stability.spec.ts, which drives the real
 * production build with a scripted thumb-drag and counts the header's
 * transform changes (99 before this fix, 1 after).
 *
 * What is modelled here is the finger. A Pixel 5 is ~70mm wide for 393 CSS px
 * — about 5.6 CSS px per millimetre — so a 2mm thumb roll-back during a slow
 * drag is ~11 CSS px. That is larger than the 8px symmetric threshold the hook
 * shipped with, which is the whole bug: normal hand tremor read as a deliberate
 * change of direction, and every wobble started a 280ms animation.
 *
 * `JITTERY_DRAG` below is that drag. The first test runs it through the LEGACY
 * behaviour (a single symmetric threshold, no cooldown — still reachable by
 * passing a number) to show the strobe is real and this file can see it; every
 * test after it runs the same drag through the defaults.
 */

/** One slow drag: forward, forward, 11px roll-back, repeated. Net downward. */
const JITTERY_DRAG: number[] = (() => {
  const ys: number[] = [];
  let y = 400;
  for (let i = 0; i < 25; i++) {
    ys.push((y += 13));
    ys.push((y += 13));
    ys.push((y -= 11));
  }
  return ys;
})();

function Probe({
  config,
  seen,
}: {
  config?: number | Parameters<typeof useScrollDirection>[0];
  seen: string[];
}) {
  const { direction, atTop } = useScrollDirection(config);
  const label = atTop ? 'top' : direction;
  if (seen[seen.length - 1] !== label) seen.push(label);
  return null;
}

let clockMs = 0;
let nowSpy: jest.SpyInstance<number, []>;
let originalRaf: typeof window.requestAnimationFrame;
let originalCaf: typeof window.cancelAnimationFrame;

beforeAll(() => {
  // The hook is rAF-throttled on purpose. jsdom's rAF is a real timer, so run
  // the callback inline to keep these tests synchronous and deterministic —
  // the same trick mobile-bottom-nav.test.tsx uses, and the reason the hook's
  // re-entrancy guard is a `pending` flag rather than the rAF id (see the long
  // comment on it: a synchronous rAF would wedge an id-based guard closed).
  originalRaf = window.requestAnimationFrame;
  originalCaf = window.cancelAnimationFrame;
  window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  }) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = () => {};
  nowSpy = jest.spyOn(performance, 'now').mockImplementation(() => clockMs);
});

afterAll(() => {
  window.requestAnimationFrame = originalRaf;
  window.cancelAnimationFrame = originalCaf;
  nowSpy.mockRestore();
});

beforeEach(() => {
  clockMs = 0;
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 727 });
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    configurable: true,
    value: 6000,
  });
});

/** A scroll sample. `ms` is how much time passed since the last one. */
function sampleAt(y: number, ms = 0) {
  clockMs += ms;
  Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
  act(() => {
    window.dispatchEvent(new Event('scroll'));
  });
}

function run(ys: number[], msPerSample = 16) {
  for (const y of ys) sampleAt(y, msPerSample);
}

describe('useScrollDirection — the strobe (#51)', () => {
  it('DEMONSTRATES the old behaviour: one symmetric 8px threshold strobes on a slow drag', () => {
    const seen: string[] = [];
    // A bare number is the legacy contract: symmetric threshold, no cooldown.
    // Kept reachable precisely so the regression this file guards has a
    // control to be compared against rather than an assertion taken on faith.
    render(<Probe config={8} seen={seen} />);
    run(JITTERY_DRAG);

    const flips = Math.max(0, seen.length - 1);
    // 75 samples of a single downward drag; the old threshold turns every
    // 11px roll-back into a direction change.
    expect(flips).toBeGreaterThan(10);
  });

  it('holds one direction through the same drag with the shipped defaults', () => {
    const seen: string[] = [];
    render(<Probe seen={seen} />);
    run(JITTERY_DRAG);

    // 'top' -> 'down', and nothing after it. One gesture, one state change.
    expect(seen).toEqual(['top', 'down']);
  });

  it('still hides on a decisive downward move', () => {
    const seen: string[] = [];
    render(<Probe seen={seen} />);
    sampleAt(300, 16);
    expect(seen[seen.length - 1]).toBe('down');
  });

  it('reveals eagerly — a 30px upward flick is enough, well short of 56px', () => {
    const seen: string[] = [];
    render(<Probe seen={seen} />);
    sampleAt(600, 16); // down
    expect(seen[seen.length - 1]).toBe('down');
    sampleAt(570, 400); // a flick back up
    expect(seen[seen.length - 1]).toBe('up');
  });

  it('is always "at top" near the very top, whatever came before', () => {
    const seen: string[] = [];
    render(<Probe seen={seen} />);
    sampleAt(600, 16);
    expect(seen[seen.length - 1]).toBe('down');
    sampleAt(0, 400);
    expect(seen[seen.length - 1]).toBe('top');
  });
});

describe('useScrollDirection — the flip cooldown (#51)', () => {
  it('refuses a second flip inside the cooldown, and applies it once the cooldown expires', () => {
    jest.useFakeTimers();
    // Modern fake timers mock requestAnimationFrame too, which would undo the
    // inline rAF installed in beforeAll and leave the hook never sampling.
    // Re-install it on top of them; only `setTimeout` needs to be fake here,
    // because the deferred re-check is what this test is about.
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    }) as typeof window.requestAnimationFrame;
    try {
      const seen: string[] = [];
      render(<Probe config={{ cooldownMs: 320 }} seen={seen} />);

      sampleAt(600, 16); // flip: down
      expect(seen[seen.length - 1]).toBe('down');

      // A large upward move 10ms later. It clears the 24px reveal threshold
      // easily, but the header's own 280ms transition is still running, so
      // reversing now would be a visible stutter.
      sampleAt(400, 10);
      expect(seen[seen.length - 1]).toBe('down');

      /*
       * And it must be DEFERRED, not dropped. Scroll events stop the instant
       * the finger lifts, so a dropped flip would strand the bar off screen
       * with nothing left to wake it — which is why the hook schedules a
       * re-sample for when the cooldown expires rather than just returning.
       */
      clockMs += 320;
      act(() => {
        jest.advanceTimersByTime(400);
      });
      expect(seen[seen.length - 1]).toBe('up');
    } finally {
      jest.useRealTimers();
      window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      }) as typeof window.requestAnimationFrame;
    }
  });
});

describe('useScrollDirection — the browser toolbar (#51, shared root cause with #50)', () => {
  it('does not read a toolbar collapse as a scroll', () => {
    const seen: string[] = [];
    render(<Probe seen={seen} />);
    sampleAt(600, 16);
    expect(seen[seen.length - 1]).toBe('down');

    /*
     * Chrome Android collapsing its toolbar grows the viewport by ~80px and
     * shifts the scroll offset in the same frame. That is the browser, not the
     * reader — judging direction from it is how the bar ends up strobing at
     * exactly the moment the toolbar animates. The hook re-anchors and waits
     * for a real move instead.
     */
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 807 });
    sampleAt(520, 16);
    expect(seen[seen.length - 1]).toBe('down');

    // The re-anchor means the next real move is judged from where the page
    // actually landed — a genuine upward flick from there still reveals.
    sampleAt(480, 400);
    expect(seen[seen.length - 1]).toBe('up');
  });
});

describe('useScrollDirection — what was already right and must stay right', () => {
  it('keeps y and atBottom fresh on sub-threshold samples', () => {
    const samples: Array<{ y: number; atBottom: boolean }> = [];
    function YProbe() {
      const { y, atBottom } = useScrollDirection();
      samples.push({ y, atBottom });
      return null;
    }
    render(<YProbe />);
    sampleAt(300, 16);
    sampleAt(303, 16); // 3px — nowhere near any threshold
    expect(samples[samples.length - 1].y).toBe(303);
  });

  it('does not let downward creep ratchet the baseline out of reach', () => {
    /*
     * The original hook was careful that a sub-threshold sample never moved
     * the baseline, so a slow accumulation still added up to a real move. That
     * property survives: while the direction is 'up' the anchor is the run's
     * MINIMUM, so forward creep cannot raise it, and 8 creeping 8px steps
     * still total the 56px that a decisive hide requires.
     */
    const seen: string[] = [];
    render(<Probe seen={seen} />);
    sampleAt(100, 16); // decisive: 'down'
    sampleAt(60, 400); // decisive flick back: 'up'
    expect(seen[seen.length - 1]).toBe('up');

    // 8px every 60ms — a genuinely slow creep, and slow enough that the flip
    // cooldown is long expired by the time the 56px is reached, so what is
    // under test here is the anchor and nothing else.
    let y = 60;
    for (let i = 0; i < 8; i++) sampleAt((y += 8), 60);
    expect(y - 60).toBeGreaterThanOrEqual(56);
    expect(seen[seen.length - 1]).toBe('down');
  });

  it('reports atBottom at the very end of the document', () => {
    const samples: boolean[] = [];
    function BottomProbe() {
      const { atBottom } = useScrollDirection();
      samples.push(atBottom);
      return null;
    }
    render(<BottomProbe />);
    sampleAt(6000 - 727, 16);
    expect(samples[samples.length - 1]).toBe(true);
  });
});
