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

describe('useScrollDirection — the top band (#61)', () => {
  /**
   * A slow drag that creeps past the top of the page, crossing y=60 and
   * re-crossing it on every thumb roll-back — 7px forward per frame, 11px back
   * every third. Net progress smaller than the tremor is what "sliding slowly"
   * means, and it is why a single boundary anywhere in the first 120px gets met
   * again and again.
   */
  const SLOW_TOP_DRAG: number[] = (() => {
    const ys: number[] = [];
    let y = 0;
    for (let i = 1; y < 120; i++) {
      y = Math.max(0, y + (i % 3 === 0 ? -11 : 7));
      ys.push(y);
    }
    return ys;
  })();

  it('DEMONSTRATES the bug: a bare `y > 60` toggles nine times over that one drag', () => {
    /*
     * The control, exactly as the first test in this file is the control for
     * #51. `scrolled = y > 60` is what Header.tsx used to compute for itself,
     * and `y` is — correctly — refreshed on every sample, so nothing in the
     * hook protects a consumer that asks the question this way.
     */
    const seen: boolean[] = [];
    function RawProbe() {
      const { y } = useScrollDirection();
      const scrolled = y > 60;
      if (seen[seen.length - 1] !== scrolled) seen.push(scrolled);
      return null;
    }
    render(<RawProbe />);
    run(SLOW_TOP_DRAG);
    expect(Math.max(0, seen.length - 1)).toBeGreaterThan(5);
  });

  it('holds one answer through the same drag when it asks `atTop` instead', () => {
    const seen: boolean[] = [];
    function AtTopProbe() {
      const { atTop } = useScrollDirection();
      if (seen[seen.length - 1] !== atTop) seen.push(atTop);
      return null;
    }
    render(<AtTopProbe />);
    run(SLOW_TOP_DRAG);
    // true (at the top) -> false (left the band), and nothing after it.
    expect(seen).toEqual([true, false]);
  });

  it('does not leave the band until 60px, and does not re-enter it until the very top', () => {
    const seen: boolean[] = [];
    function AtTopProbe() {
      const { atTop } = useScrollDirection();
      if (seen[seen.length - 1] !== atTop) seen.push(atTop);
      return null;
    }
    render(<AtTopProbe />);

    sampleAt(40, 16); // inside the band
    expect(seen[seen.length - 1]).toBe(true);
    sampleAt(61, 16); // out
    expect(seen[seen.length - 1]).toBe(false);
    sampleAt(40, 16); // 40 is not a way back IN — that is the whole point
    expect(seen[seen.length - 1]).toBe(false);
    sampleAt(5, 16); // nor is 5
    expect(seen[seen.length - 1]).toBe(false);
    sampleAt(0, 16); // the very top is
    expect(seen[seen.length - 1]).toBe(true);
  });

  it('a settle at the very top cannot toggle the band', () => {
    const seen: boolean[] = [];
    function AtTopProbe() {
      const { atTop } = useScrollDirection();
      if (seen[seen.length - 1] !== atTop) seen.push(atTop);
      return null;
    }
    render(<AtTopProbe />);
    // Momentum / an overscroll rubber-band / scroll anchoring, all of which
    // land within a few px of 0 and used to cross the 4px edge for free.
    run([0, 3, 6, 2, 9, 1, 5, 0, 7, 2], 16);
    expect(seen).toEqual([true]);
  });

  it('never reports the band and a downward direction at the same time', () => {
    /*
     * The invariant Header.tsx and MobileBottomNav.tsx both depend on, and the
     * reason `atTop` can be combined with `direction` at all. Locked in here
     * because it used to hold only by accident: `atTop` is published as true
     * only from the branch that also pins `direction` to 'up'.
     */
    const pairs: Array<[boolean, string]> = [];
    function PairProbe() {
      const { atTop, direction } = useScrollDirection();
      pairs.push([atTop, direction]);
      return null;
    }
    render(<PairProbe />);
    run(SLOW_TOP_DRAG);
    run([400, 380, 500, 470, 60, 30, 2, 0, 90, 200], 400);
    expect(pairs.filter(([atTop, direction]) => atTop && direction === 'down')).toEqual([]);
  });

  it('a toolbar collapse cannot move the band', () => {
    const seen: boolean[] = [];
    function AtTopProbe() {
      const { atTop } = useScrollDirection();
      if (seen[seen.length - 1] !== atTop) seen.push(atTop);
      return null;
    }
    render(<AtTopProbe />);
    sampleAt(40, 16);
    expect(seen[seen.length - 1]).toBe(true);

    // The browser, not the reader: the viewport grows by ~80px and the offset
    // shifts past the band edge in the same frame.
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 807 });
    sampleAt(95, 16);
    expect(seen[seen.length - 1]).toBe(true);

    // A real move from where the page landed still leaves the band.
    sampleAt(110, 16);
    expect(seen[seen.length - 1]).toBe(false);
  });

  it('still hides only after a decisive move, now measured from the band edge', () => {
    const seen: string[] = [];
    render(<Probe seen={seen} />);
    // A real drag out of the band. The bar must NOT have been asked to hide by
    // 90px — the page has moved less than the header's own height.
    run(
      (() => {
        const ys: number[] = [];
        let y = 0;
        for (let i = 1; y < 90; i++) {
          y = Math.max(0, y + (i % 3 === 0 ? -11 : 7));
          ys.push(y);
        }
        return ys;
      })(),
    );
    // 'top' -> 'up': it has left the band (so a hero header goes solid) but
    // 'down' never appears, so the bar was never asked to leave the screen.
    expect(seen).toEqual(['top', 'up']);

    // Carry on past the band edge plus the 56px a hide costs, and it hides.
    run([130, 140, 150], 16);
    expect(seen[seen.length - 1]).toBe('down');
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
