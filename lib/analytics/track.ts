import type {
  AnalyticsCollectPayload,
  AnalyticsEventBase,
  AnalyticsEventName,
  AnalyticsPropsOf,
} from './events';
import { buildBatchContext } from './context';
import { ANALYTICS_DISABLED, MAX_BATCH_SIZE } from './config';
import { dequeueAll, enqueue, requeue, shouldFlushForSize } from './queue';
import { getTabSessionId } from './session';
import { sendBeacon, sendFetch } from './transport';
import { trackMetaPixelEvent } from './meta-pixel';
import { trackTikTokEvent } from './tiktok-pixel';

const PAYLOAD_VERSION = 1 as const;

function normaliseSearch(search: string): string {
  if (!search) return '';
  const params = new URLSearchParams(search);
  const keys = Array.from(new Set(params.keys())).sort();
  if (keys.length === 0) return '';
  const sorted = new URLSearchParams();
  for (const key of keys) {
    for (const value of params.getAll(key)) sorted.append(key, value);
  }
  const s = sorted.toString();
  return s ? `?${s}` : '';
}

function currentPage(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.location.pathname + normaliseSearch(window.location.search);
}

/**
 * The public tracking API. Fully type-checked against the shared registry —
 * `props` must match exactly the shape `lib/analytics/events.ts` (this app's
 * vendored copy of the shared registry) declares for `name`, so a wrong or
 * extra field is a compile error, not a runtime surprise.
 *
 * Never throws: the whole body is wrapped so a bug here can never break the
 * storefront. No-ops when the kill switch is set, during SSR, or once
 * `window` is gone (e.g. called from a cleanup function after unmount).
 */
export function track<K extends AnalyticsEventName>(name: K, props: AnalyticsPropsOf<K>): void {
  try {
    if (ANALYTICS_DISABLED) return;
    if (typeof window === 'undefined') return;

    const event: AnalyticsEventBase = {
      id: crypto.randomUUID(),
      n: name,
      t: Date.now(),
      s: getTabSessionId(),
      p: currentPage(),
      d: typeof document !== 'undefined' ? document.title : undefined,
      v: props as Record<string, unknown>,
    };

    enqueue(event);

    const metaProps = props as Record<string, unknown>;
    if (name === 'product_view') {
      trackMetaPixelEvent(
        'ViewContent',
        {
          content_ids: [metaProps.productId],
          content_type: 'product',
          value: Number(metaProps.priceMinor) / 100,
          currency: 'EGP',
        },
        event.id,
      );
      trackTikTokEvent('ViewContent', { content_id: metaProps.productId, content_type: 'product', value: Number(metaProps.priceMinor) / 100, currency: 'EGP' }, event.id);
    } else if (name === 'add_to_cart') {
      trackMetaPixelEvent(
        'AddToCart',
        {
          content_ids: [metaProps.productId],
          content_type: 'product',
          value: (Number(metaProps.priceMinor) * Number(metaProps.qty)) / 100,
          currency: 'EGP',
        },
        event.id,
      );
      trackTikTokEvent('AddToCart', { content_id: metaProps.productId, content_type: 'product', value: (Number(metaProps.priceMinor) * Number(metaProps.qty)) / 100, currency: 'EGP', quantity: Number(metaProps.qty) }, event.id);
    } else if (name === 'begin_checkout') {
      trackMetaPixelEvent(
        'InitiateCheckout',
        {
          value: Number(metaProps.subtotalMinor) / 100,
          currency: 'EGP',
          num_items: Number(metaProps.itemCount),
        },
        event.id,
      );
      trackTikTokEvent('InitiateCheckout', { content_id: String(metaProps.cartId || 'cart'), content_type: 'product', value: Number(metaProps.subtotalMinor) / 100, currency: 'EGP', quantity: Number(metaProps.itemCount) }, event.id);
    }

    if (shouldFlushForSize(MAX_BATCH_SIZE)) {
      void flush();
    }
  } catch {
    // A tracking bug must never break the storefront.
  }
}

function buildPayload(events: AnalyticsEventBase[]): AnalyticsCollectPayload {
  return {
    ver: PAYLOAD_VERSION,
    ctx: buildBatchContext(),
    ev: events,
  };
}

/**
 * Normal flush path — fetch first, falling back to sendBeacon only if fetch
 * throws (see transport.ts). Used by the 1s timer, the batch-size trigger,
 * and `visibilitychange -> hidden`.
 */
export async function flush(): Promise<void> {
  try {
    if (ANALYTICS_DISABLED) return;
    const events = dequeueAll();
    if (events.length === 0) return;

    const ok = await sendFetch(buildPayload(events));
    if (!ok) requeue(events);
  } catch {
    // Never let a flush failure surface as an unhandled rejection.
  }
}

/**
 * `pagehide` flush path — goes straight to `sendBeacon`, synchronously,
 * skipping the fetch attempt entirely. The page may be gone before a fetch
 * promise (even a keepalive one) would resolve; `sendBeacon` is designed for
 * exactly this moment.
 */
export function flushBeacon(): void {
  try {
    if (ANALYTICS_DISABLED) return;
    const events = dequeueAll();
    if (events.length === 0) return;

    if (!sendBeacon(buildPayload(events))) {
      requeue(events);
    }
  } catch {
    // Never let a flush failure break page teardown.
  }
}
