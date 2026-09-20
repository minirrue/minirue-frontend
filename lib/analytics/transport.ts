import type { AnalyticsCollectPayload } from './events';
import { ANALYTICS_ENDPOINT } from './config';
import { getVisitorIdForHeader } from './attribution';

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
 *
 * `x-mr-vid` (backend#224 / frontend#188) is added only as a rescue: when
 * `mr-vid` is HttpOnly and unreadable here, `getVisitorIdForHeader` falls
 * back to the readable mirror cookie or, failing that, the localStorage copy
 * `syncVisitorIdMirror` maintains. This client never mints an id — a miss
 * here just means no header is sent and the server (proxy.ts) mints on its
 * next response. `sendBeacon`'s API has no header support, so the rescue
 * only reaches the server via this path, not the `pagehide` beacon fallback.
 */
export async function sendFetch(payload: AnalyticsCollectPayload): Promise<boolean> {
  try {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    const vid = getVisitorIdForHeader();
    if (vid) headers['x-mr-vid'] = vid;

    const res = await fetch(ANALYTICS_ENDPOINT, {
      method: 'POST',
      keepalive: true,
      credentials: 'include',
      headers,
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return sendBeacon(payload);
  }
}
