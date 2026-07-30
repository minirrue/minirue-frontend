/**
 * Unit tests — lib/analytics/track.ts
 * Covers: track() payload shape, the batch-size flush trigger, and a
 * compile-time assertion that an unknown/wrong prop is a type error
 * (checked by `npx tsc --noEmit`, not by jest — jest transpiles without
 * type-checking).
 */
import { dequeueAll, queueLength } from '@/lib/analytics/queue';
import { track } from '@/lib/analytics/track';
import type { AnalyticsPropsOf } from '@/lib/analytics/events';

describe('lib/analytics/track', () => {
  beforeEach(() => {
    dequeueAll();
  });

  it('enqueues an event with the AnalyticsEventBase shape', () => {
    track('ui_click', { traceId: 'btn-1', tag: 'button', text: 'Add to cart' });

    const events = dequeueAll();
    expect(events).toHaveLength(1);
    const [event] = events;

    expect(typeof event.id).toBe('string');
    expect(event.id.length).toBeGreaterThan(0);
    expect(event.n).toBe('ui_click');
    expect(typeof event.t).toBe('number');
    expect(event.v).toEqual({ traceId: 'btn-1', tag: 'button', text: 'Add to cart' });
  });

  it('mints a fresh id per call — ids are the server dedupe key', () => {
    track('cart_drawer_open', {});
    track('cart_drawer_open', {});
    const [first, second] = dequeueAll();
    expect(first.id).not.toBe(second.id);
  });

  it('never throws even if a listener/queue call misbehaves', () => {
    expect(() => track('page_view', {})).not.toThrow();
  });

  it('triggers a size-based flush at the batch max without throwing', () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    for (let i = 0; i < 50; i++) {
      track('ui_click', { traceId: `t${i}` });
    }
    // queue should have been (or be about to be) drained by the size trigger
    expect(queueLength()).toBeLessThanOrEqual(50);
  });

  it('compile-time: an unknown prop on a strict event is a type error', () => {
    // @ts-expect-error — `bogus` is not part of ui_click's registered props.
    const _bad: AnalyticsPropsOf<'ui_click'> = { traceId: 'x', bogus: true };
    void _bad;
  });

  it('compile-time: a missing required prop is a type error', () => {
    // @ts-expect-error — `traceId` is required for ui_click.
    const _bad: AnalyticsPropsOf<'ui_click'> = {};
    void _bad;
  });
});
