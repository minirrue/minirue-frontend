import { track } from './track';

/**
 * LCP, CLS and INP, read directly off `PerformanceObserver` — no `web-vitals`
 * package. Each is reported at most once per page load, on
 * `visibilitychange -> hidden`, using the standard CrUX
 * good/needs-improvement/poor thresholds.
 */

type VitalMetric = 'LCP' | 'CLS' | 'INP';
type Rating = 'good' | 'needs-improvement' | 'poor';

const THRESHOLDS: Record<VitalMetric, readonly [number, number]> = {
  LCP: [2500, 4000],
  CLS: [0.1, 0.25],
  INP: [200, 500],
};

function rate(metric: VitalMetric, value: number): Rating {
  const [good, poor] = THRESHOLDS[metric];
  if (value <= good) return 'good';
  if (value <= poor) return 'needs-improvement';
  return 'poor';
}

let lcpValue: number | null = null;
let clsValue = 0;
let inpValue = 0;
let reportedLcp = false;
let reportedCls = false;
let reportedInp = false;
let initialised = false;

function observe(
  type: string,
  callback: (list: PerformanceObserverEntryList) => void,
  options?: Record<string, unknown>,
): void {
  if (typeof PerformanceObserver === 'undefined') return;
  try {
    const po = new PerformanceObserver(callback);
    po.observe({ type, buffered: true, ...options } as PerformanceObserverInit);
  } catch {
    // Entry type unsupported in this browser — that metric simply never
    // reports, which is fine; the other two are independent.
  }
}

/** Sets up the three observers. Call once, on mount. */
export function initWebVitals(): void {
  if (typeof window === 'undefined' || initialised) return;
  initialised = true;

  observe('largest-contentful-paint', (list) => {
    const entries = list.getEntries() as (PerformanceEntry & { startTime: number })[];
    const last = entries[entries.length - 1];
    if (last) lcpValue = last.startTime;
  });

  observe('layout-shift', (list) => {
    const entries = list.getEntries() as (PerformanceEntry & {
      value: number;
      hadRecentInput: boolean;
    })[];
    for (const entry of entries) {
      if (!entry.hadRecentInput) clsValue += entry.value;
    }
  });

  observe(
    'event',
    (list) => {
      const entries = list.getEntries() as (PerformanceEntry & {
        interactionId?: number;
        duration: number;
      })[];
      for (const entry of entries) {
        if (entry.interactionId && entry.duration > inpValue) {
          inpValue = entry.duration;
        }
      }
    },
    { durationThreshold: 40 },
  );
}

/** Reports whatever has been observed so far. Call from `visibilitychange -> hidden`. */
export function reportWebVitalsOnHidden(): void {
  if (!reportedLcp && lcpValue !== null) {
    reportedLcp = true;
    track('web_vital', { metric: 'LCP', value: lcpValue, rating: rate('LCP', lcpValue) });
  }
  if (!reportedCls) {
    reportedCls = true;
    track('web_vital', { metric: 'CLS', value: clsValue, rating: rate('CLS', clsValue) });
  }
  if (!reportedInp && inpValue > 0) {
    reportedInp = true;
    track('web_vital', { metric: 'INP', value: inpValue, rating: rate('INP', inpValue) });
  }
}
