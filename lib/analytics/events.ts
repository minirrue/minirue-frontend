// analytics-events — shared taxonomy for first-party web analytics.
//
// NO ZOD IN THIS FILE. `packages/contracts` pins zod ^3.25.76 while
// apps/minirue-frontend and apps/minirue-dashboard run zod 4.3. Module
// resolution binds contracts to zod 3 and the apps to zod 4, so a schema
// object crossing that boundary is two different classes — `.extend()`,
// `.merge()`, `instanceof`, and `z.infer` all misbehave, and bundlers ship
// both copies. Export plain TypeScript types and `as const` arrays only:
// types erase at build time and are version-agnostic. Do not "improve"
// this file by adding a zod schema.
//
// VENDORED, NOT IMPORTED. This app's Dockerfile builds with
// apps/minirue-frontend as its build context (`COPY package.json
// package-lock.json* ./`, `npm ci`, then `COPY . .`), so `packages/contracts`
// — which lives outside that context — is never copied into the image, and
// `npm ci` against this app's own lockfile has no way to install a workspace
// package that isn't part of this build. Importing `@minirue/contracts` here
// would compile locally and fail in production. This file is therefore a
// verbatim copy of `packages/contracts/src/analytics-events.ts`, owned by
// this app. `apps/minirue-backend` keeps its own copy too; the three are
// expected to stay in step by convention, not by a shared import. Drift
// shows up as data, not as a crash: the backend records an event name it
// doesn't recognise in its rejects table instead of failing the request.

/**
 * The full event-name registry, grouped by domain. Keep the grouping
 * comments — they are the registry's documentation.
 */
export const ANALYTICS_EVENT_NAMES = [
  // traffic
  'page_view',
  'page_leave',
  'scroll_depth',
  'outbound_click',
  'not_found',
  'js_error',
  'web_vital',
  'rage_click',
  'dead_click',

  // catalog
  'list_view',
  'product_impression',
  'product_click',
  'product_view',
  'variant_select',
  'gallery_open',
  'review_read',
  'review_submit',
  'wishlist_add',
  'wishlist_remove',
  'share_click',

  // search
  'search',
  'search_zero_results',
  'search_result_click',
  'filter_apply',
  'sort_apply',

  // cart
  'add_to_cart',
  'remove_from_cart',
  'cart_qty_change',
  'cart_drawer_open',
  'cart_view',

  // checkout (browser-observed)
  'begin_checkout',
  'checkout_step_view',
  'checkout_address_entered',
  'checkout_shipping_selected',
  'checkout_payment_selected',
  'checkout_validation_error',
  'payment_initiated',
  'payment_client_error',

  // conversion (server-emitted only)
  'purchase',
  'payment_succeeded',
  'payment_failed',
  'order_cancelled',

  // account
  'signup_start',
  'signup_complete',
  'login',
  'logout',

  // support
  'support_open',
  'support_message_sent',

  // marketing
  'announcement_click',
  'newsletter_signup',
  'promo_applied',
  'promo_rejected',

  // generic
  'ui_click',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

/**
 * Conversion events are emitted server-side only, inside the checkout
 * transaction, so tracked revenue reconciles exactly with the `orders`
 * table. The collector rejects any of these arriving from a browser with
 * reason `SERVER_ONLY`.
 */
export const SERVER_ONLY_EVENTS = [
  'purchase',
  'payment_succeeded',
  'payment_failed',
  'order_cancelled',
] as const;

export type ServerOnlyEvent = (typeof SERVER_ONLY_EVENTS)[number];

/**
 * A single analytics event. Field names are kept short — this goes over
 * the wire on every pageview and the storefront has a 250 KB JS budget.
 */
export interface AnalyticsEventBase {
  /** crypto.randomUUID() — the dedupe key, stable across retries. */
  id: string;
  /** The event name. */
  n: AnalyticsEventName;
  /** Client epoch ms; the server clamps it. */
  t: number;
  /** Per-tab id from sessionStorage. */
  s?: string;
  /** location.pathname + normalised search. */
  p?: string;
  /** Page code, e.g. PG-STOREFRONT-CAT-005. */
  pc?: string;
  /** document.title. */
  d?: string;
  /** Props, narrowed by AnalyticsEventProps. */
  v?: Record<string, unknown>;
}

/**
 * Context sent once per batch, not per event (saves ~200 bytes × N).
 */
export interface AnalyticsBatchContext {
  /** Referrer. */
  r?: string;
  /** UTM source/medium/campaign/content/term. */
  u?: {
    s?: string;
    m?: string;
    c?: string;
    ct?: string;
    tm?: string;
  };
  /** The `mr-cart-session` value so events stitch to `carts.session_id`. */
  cs?: string;
  /** Viewport width. */
  w?: number;
  /** Viewport height. */
  h?: number;
  /** navigator.language. */
  l?: string;
  /** Client hints from navigator.userAgentData: brand/platform/mobile. */
  ch?: {
    b?: string;
    pl?: string;
    mo?: boolean;
  };
  /** navigator.webdriver. */
  wd?: boolean;
  /** Colour depth. */
  cd?: number;
  /** hardwareConcurrency. */
  hc?: number;
}

/**
 * The wire payload for the collector's ingest endpoint.
 * `ver` is bumped on a breaking change; the server accepts `1..N`.
 */
export interface AnalyticsCollectPayload {
  ver: 1;
  ctx: AnalyticsBatchContext;
  ev: AnalyticsEventBase[];
}

/**
 * The strict props registry — one entry per event name. Money is always
 * `...Minor: number` (piastres, integer) — never a float, never a string.
 */
export interface AnalyticsEventProps {
  // traffic
  page_view: Record<string, never>;
  page_leave: { ms: number; maxScroll?: number };
  scroll_depth: { pct: 25 | 50 | 75 | 100 };
  outbound_click: { url: string; text?: string };
  not_found: { path: string };
  js_error: { message: string; stack?: string; source?: string };
  web_vital: {
    metric: 'LCP' | 'CLS' | 'INP' | 'FCP' | 'TTFB';
    value: number;
    rating: 'good' | 'needs-improvement' | 'poor';
  };
  rage_click: { x: number; y: number; count: number };
  dead_click: { x: number; y: number; tag?: string };

  // catalog
  list_view: { listId: string; itemCount: number };
  product_impression: { productId: string; listId?: string; position: number };
  product_click: { productId: string; listId?: string; position: number };
  product_view: {
    productId: string;
    variantId?: string;
    priceMinor: number;
    brand?: string;
    categoryId?: string;
    inStock: boolean;
  };
  variant_select: { productId: string; variantId: string; attribute?: string };
  gallery_open: { productId: string; index?: number };
  review_read: { productId: string; reviewId?: string };
  review_submit: { productId: string; rating: number };
  wishlist_add: { productId: string; variantId?: string };
  wishlist_remove: { productId: string; variantId?: string };
  share_click: { productId: string; channel?: string };

  // search
  search: { q: string; results: number };
  search_zero_results: { q: string };
  search_result_click: { q: string; productId: string; position: number };
  filter_apply: { key: string; value: string };
  sort_apply: { key: string };

  // cart
  add_to_cart: {
    productId: string;
    variantId: string;
    qty: number;
    priceMinor: number;
    source?: 'pdp' | 'list' | 'drawer' | 'sticky';
  };
  remove_from_cart: { productId: string; variantId: string; qty: number; priceMinor: number };
  cart_qty_change: { productId: string; variantId: string; qty: number; delta: number };
  cart_drawer_open: Record<string, never>;
  cart_view: { itemCount: number; subtotalMinor: number };

  // checkout (browser-observed)
  begin_checkout: { cartId: string; itemCount: number; subtotalMinor: number };
  checkout_step_view: { step: 'address' | 'shipping' | 'payment' | 'review'; cartId?: string };
  checkout_address_entered: { cartId?: string; hasAddress: boolean };
  checkout_shipping_selected: { method: string; cartId?: string };
  checkout_payment_selected: { method: 'COD' | 'INSTAPAY' };
  checkout_validation_error: { step: string; field: string; issue: string };
  payment_initiated: { method: 'COD' | 'INSTAPAY'; cartId: string; totalMinor: number };
  payment_client_error: { method: 'COD' | 'INSTAPAY'; message: string };

  // conversion (server-emitted only)
  purchase: {
    orderId: string;
    orderNumber: string;
    totalMinor: number;
    itemCount: number;
    method: string;
    channel: 'ONLINE' | 'MANUAL';
  };
  payment_succeeded: { orderId: string; totalMinor: number; method: string };
  payment_failed: { orderId?: string; reason: string; method: string };
  order_cancelled: { orderId: string; reason?: string };

  // account
  signup_start: Record<string, never>;
  signup_complete: { userId: string };
  login: { method?: string };
  logout: Record<string, never>;

  // support
  support_open: Record<string, never>;
  support_message_sent: { length: number };

  // marketing
  announcement_click: { id: string };
  newsletter_signup: { placement?: string };
  promo_applied: { code: string; discountMinor?: number };
  promo_rejected: { code: string; reason: string };

  // generic
  ui_click: { traceId: string; text?: string; tag?: string };
}

// Compile-time exhaustiveness check: every name in ANALYTICS_EVENT_NAMES
// must have a key in AnalyticsEventProps. A forgotten entry is a build
// error here, not a runtime surprise.
type _Exhaustive = Exclude<AnalyticsEventName, keyof AnalyticsEventProps> extends never
  ? true
  : never;
const _check: _Exhaustive = true;
void _check;

/**
 * A discriminated union mapping each event name to its props, so
 * `track(name, props)` is type-checked at every call site.
 */
export type TrackedEvent = {
  [K in AnalyticsEventName]: {
    n: K;
    v: K extends keyof AnalyticsEventProps ? AnalyticsEventProps[K] : Record<string, never>;
  };
}[AnalyticsEventName];

/** Ergonomic lookup of the props type for a given event name. */
export type AnalyticsPropsOf<K extends AnalyticsEventName> = K extends keyof AnalyticsEventProps
  ? AnalyticsEventProps[K]
  : Record<string, never>;
