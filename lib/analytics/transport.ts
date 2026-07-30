import type { AnalyticsCollectPayload } from './events';
import { ANALYTICS_ENDPOINT } from './config';

/**
 * `sendBeacon` MUST use `text/plain` — any other MIME type triggers a CORS
 * preflight, which a beacon cannot perform (it fires-and-forgets, often as
 * the page is unloading), so the request would be silently dropped. The
 * backend has a matching `text/plain` body parser at `POST /v1/mr-signal`
 * for exactly this reason.
 */
export function sendBeacon(payload: AnalyticsCollectPayload): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
    return false;
  }
  try {
    const blob = new Blob([JSON.stringify(payload)], { type: 'text/plain' });
    return navigator.sendBeacon(ANALYTICS_ENDPOINT, blob);
  } catch {
    return false;
  }
}

/**
 * Primary flush path: `fetch` with `keepalive` so the request can outlive a
 * page navigation, and `credentials: 'include'` — without it the `mr-vid`
 * cookie never travels to the API's origin. Falls back to `sendBeacon` if
 * `fetch` throws (e.g. the network is down, or the browser refuses a
 * keepalive request over its body-size limit).
 */
export async function sendFetch(payload: AnalyticsCollectPayload): Promise<boolean> {
  try {
    const res = await fetch(ANALYTICS_ENDPOINT, {
      method: 'POST',
      keepalive: true,
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return sendBeacon(payload);
  }
}
