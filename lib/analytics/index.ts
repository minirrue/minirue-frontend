/**
 * Public surface for consumers outside `lib/analytics/` — the cart, product
 * and checkout components a later lane wires up should only need this file.
 */
export { track } from './track';
export { attributionHeaders } from './attribution';
export type { AnalyticsEventName, AnalyticsPropsOf } from './events';
