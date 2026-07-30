import { track } from './track';

/**
 * One delegated, capturing listener on `document` gives near-total
 * interaction coverage without touching 38 components — the storefront
 * already carries 136 `data-trace-id` attributes across 46 files, including
 * the shared `components/ui/Button.tsx` and `Input.tsx`. `capture: true`
 * matters: a component that calls `stopPropagation()` on a bubbling handler
 * would otherwise swallow this before it ever runs.
 *
 * The same listener derives rage clicks (>= 3 clicks on one `traceId` within
 * 1000ms) and dead clicks (a click on an interactive `traceId` with no DOM
 * mutation, navigation or fetch within 500ms).
 */

const RAGE_WINDOW_MS = 1000;
const RAGE_THRESHOLD = 3;
const DEAD_CLICK_WINDOW_MS = 500;

const rageState = new Map<string, { count: number; firstAt: number }>();

function checkRageClick(traceId: string, x: number, y: number): void {
  const now = Date.now();
  const existing = rageState.get(traceId);
  if (existing && now - existing.firstAt <= RAGE_WINDOW_MS) {
    existing.count += 1;
    if (existing.count === RAGE_THRESHOLD) {
      track('rage_click', { x, y, count: existing.count });
    }
  } else {
    rageState.set(traceId, { count: 1, firstAt: now });
  }
}

// A fetch counts as "the click did something" even when nothing has changed
// in the DOM yet (e.g. an in-flight add-to-cart call). `window.fetch` is
// patched once, defensively — it always forwards to the original
// implementation unchanged, only recording a timestamp.
let lastNetworkActivityAt = 0;
let fetchPatched = false;
function patchFetchOnce(): void {
  if (fetchPatched || typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  fetchPatched = true;
  const original = window.fetch.bind(window);
  window.fetch = ((...args: Parameters<typeof fetch>) => {
    lastNetworkActivityAt = Date.now();
    return original(...args);
  }) as typeof fetch;
}

function watchForDeadClick(el: Element, x: number, y: number, clickedAt: number): void {
  if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;

  const startHref = window.location.href;
  let mutated = false;

  const observer = new MutationObserver(() => {
    mutated = true;
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true });

  window.setTimeout(() => {
    observer.disconnect();
    const navigated = window.location.href !== startHref;
    const networked = lastNetworkActivityAt >= clickedAt;
    if (!mutated && !navigated && !networked) {
      track('dead_click', { x, y, tag: el.tagName.toLowerCase() });
    }
  }, DEAD_CLICK_WINDOW_MS);
}

/** Installs the delegated click listener. Call once from AnalyticsProvider on mount. */
export function initUiClickTracking(): () => void {
  if (typeof document === 'undefined') return () => {};
  patchFetchOnce();

  function handleClick(e: MouseEvent): void {
    const target = e.target as Element | null;
    const el = target?.closest?.('[data-trace-id]');
    if (!el) return;

    const traceId = el.getAttribute('data-trace-id');
    if (!traceId) return;

    track('ui_click', {
      traceId,
      tag: el.tagName.toLowerCase(),
      text: (el.textContent ?? '').trim().slice(0, 60),
    });

    checkRageClick(traceId, e.clientX, e.clientY);
    watchForDeadClick(el, e.clientX, e.clientY, Date.now());
  }

  document.addEventListener('click', handleClick, { capture: true, passive: true });
  return () => document.removeEventListener('click', handleClick, { capture: true });
}
