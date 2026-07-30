/**
 * Unit tests — lib/analytics/queue.ts
 * Covers: dedupe-by-id, cap + spill/restore.
 */
import {
  dequeueAll,
  enqueue,
  queueLength,
  requeue,
  restoreSpill,
  shouldFlushForSize,
  spill,
} from '@/lib/analytics/queue';
import type { AnalyticsEventBase } from '@/lib/analytics/events';

function makeEvent(id: string, n = 'ui_click'): AnalyticsEventBase {
  return { id, n: n as AnalyticsEventBase['n'], t: Date.now() };
}

describe('lib/analytics/queue', () => {
  beforeEach(() => {
    dequeueAll(); // drain any leftovers between tests
    window.localStorage.clear();
  });

  it('enqueues and dequeues in order, then empties', () => {
    enqueue(makeEvent('a'));
    enqueue(makeEvent('b'));
    expect(queueLength()).toBe(2);

    const drained = dequeueAll();
    expect(drained.map((e) => e.id)).toEqual(['a', 'b']);
    expect(queueLength()).toBe(0);
  });

  it('reports the size flush trigger once the batch max is reached', () => {
    for (let i = 0; i < 49; i++) enqueue(makeEvent(`e${i}`));
    expect(shouldFlushForSize(50)).toBe(false);
    enqueue(makeEvent('e49'));
    expect(shouldFlushForSize(50)).toBe(true);
  });

  it('requeue dedupes by id — a retried event never double-counts', () => {
    enqueue(makeEvent('dup'));
    const inFlight = dequeueAll();
    enqueue(makeEvent('dup')); // e.g. a new call raced in with the same id
    requeue(inFlight);

    const drained = dequeueAll();
    expect(drained.filter((e) => e.id === 'dup')).toHaveLength(1);
  });

  it('spills to localStorage and restoreSpill pulls it back, deduped', () => {
    enqueue(makeEvent('spill-1'));
    enqueue(makeEvent('spill-2'));
    spill();
    expect(queueLength()).toBe(2); // spill() persists, doesn't drain memory

    dequeueAll(); // simulate a fresh page load — memory queue is empty
    restoreSpill();

    const drained = dequeueAll();
    expect(drained.map((e) => e.id).sort()).toEqual(['spill-1', 'spill-2']);
  });

  it('restoreSpill dedupes against events already enqueued this load', () => {
    enqueue(makeEvent('shared'));
    spill();
    dequeueAll();

    enqueue(makeEvent('shared')); // this page load already queued the same id
    restoreSpill();

    const drained = dequeueAll();
    expect(drained.filter((e) => e.id === 'shared')).toHaveLength(1);
  });

  it('caps the persisted spill at 50 events, dropping the oldest first', () => {
    for (let i = 0; i < 60; i++) enqueue(makeEvent(`c${i}`));
    spill();
    dequeueAll();
    restoreSpill();

    const drained = dequeueAll();
    expect(drained.length).toBeLessThanOrEqual(50);
    // the newest ids should have survived, not the oldest
    expect(drained.some((e) => e.id === 'c59')).toBe(true);
    expect(drained.some((e) => e.id === 'c0')).toBe(false);
  });
});
