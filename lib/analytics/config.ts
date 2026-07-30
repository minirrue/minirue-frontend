/**
 * Collector endpoint.
 *
 * Deliberately NOT named `/collect`, `/track`, `/analytics` or `/event` —
 * EasyPrivacy and uBlock Origin's default filter lists block request paths
 * containing exactly those fragments, which would silently drop a large
 * slice of real (non-bot) traffic before it ever left the browser.
 * `mr-signal` matches none of the common filter list rules.
 *
 * Accepts both `application/json` (fetch path) and `text/plain` (sendBeacon
 * path — see transport.ts) bodies.
 */
export const ANALYTICS_ENDPOINT =
  (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8002') + '/v1/mr-signal';

/** How often the queue is flushed on a timer, in ms. */
export const FLUSH_INTERVAL_MS = 1000;

/** Flushing also triggers as soon as the in-memory queue reaches this size. */
export const MAX_BATCH_SIZE = 50;

/**
 * Kill switch. Set `NEXT_PUBLIC_ANALYTICS_DISABLED=1` (or `"true"`) to fully
 * no-op every tracking call — no listeners installed, nothing queued, nothing
 * sent.
 */
export const ANALYTICS_DISABLED: boolean =
  process.env.NEXT_PUBLIC_ANALYTICS_DISABLED === '1' ||
  process.env.NEXT_PUBLIC_ANALYTICS_DISABLED === 'true';
