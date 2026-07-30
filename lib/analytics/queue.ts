import type { AnalyticsEventBase } from './events';

/**
 * In-memory queue with a `localStorage` spill so an offline moment or a
 * failed flush is retried on the next page load, rather than lost. Every
 * event carries its `id` (minted once, at `track()` time — see track.ts) as
 * the server's dedupe key, so retrying the same event object twice can never
 * double-count.
 */

const STORAGE_KEY = 'mr-analytics-pending';
const MAX_STORAGE_EVENTS = 50;
const MAX_STORAGE_BYTES = 32 * 1024;

let memoryQueue: AnalyticsEventBase[] = [];

function dedupeById(events: AnalyticsEventBase[]): AnalyticsEventBase[] {
  const seen = new Set<string>();
  const result: AnalyticsEventBase[] = [];
  for (const event of events) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    result.push(event);
  }
  return result;
}

function readSpill(): AnalyticsEventBase[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AnalyticsEventBase[]) : [];
  } catch {
    return [];
  }
}

function writeSpill(events: AnalyticsEventBase[]): void {
  if (typeof window === 'undefined') return;
  try {
    let capped = events.slice(-MAX_STORAGE_EVENTS);
    let serialized = JSON.stringify(capped);
    // Drop the oldest events until the payload fits the byte budget.
    while (serialized.length > MAX_STORAGE_BYTES && capped.length > 0) {
      capped = capped.slice(1);
      serialized = JSON.stringify(capped);
    }
    if (capped.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, serialized);
    }
  } catch {
    // Storage full or unavailable (Safari private mode, quota exceeded) — the
    // in-memory queue still works for the current tab; only the cross-reload
    // retry is lost.
  }
}

/** Add an event to the in-memory queue. */
export function enqueue(event: AnalyticsEventBase): void {
  memoryQueue.push(event);
}

/** Remove and return every currently queued event. */
export function dequeueAll(): AnalyticsEventBase[] {
  const events = memoryQueue;
  memoryQueue = [];
  return events;
}

/** True once the queue has reached the batch-size flush trigger. */
export function shouldFlushForSize(maxBatch: number): boolean {
  return memoryQueue.length >= maxBatch;
}

/** Put events back at the FRONT of the queue after a failed flush, deduped by id. */
export function requeue(events: AnalyticsEventBase[]): void {
  if (events.length === 0) return;
  memoryQueue = dedupeById([...events, ...memoryQueue]);
}

/** Persist any not-yet-sent events before the tab dies. No-op if the queue is empty. */
export function spill(): void {
  if (memoryQueue.length === 0) return;
  writeSpill(dedupeById([...readSpill(), ...memoryQueue]));
}

/**
 * Pulls back anything a previous tab/page load couldn't send and clears the
 * spill slot. Call once, on mount.
 */
export function restoreSpill(): void {
  const restored = readSpill();
  if (restored.length === 0) return;
  memoryQueue = dedupeById([...restored, ...memoryQueue]);
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Non-fatal — the events are already in the in-memory queue.
  }
}

/** Test/debug helper — current in-memory queue length. */
export function queueLength(): number {
  return memoryQueue.length;
}
