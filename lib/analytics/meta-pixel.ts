import { ADS_OFF_INLINE_CHECK, isAdsOff } from './ads-off';

/**
 * Meta (Facebook) Pixel ID. The shop's own pixel is the default;
 * NEXT_PUBLIC_META_PIXEL_ID overrides it (build-time, so redeploy after
 * changing it). Anything that is not all digits disables the pixel rather
 * than being interpolated into an inline script.
 */
const raw = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || '2165922481025159';

export const META_PIXEL_ID: string | null = /^\d+$/.test(raw) ? raw : null;

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

type MetaStandardEvent = 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase';

/**
 * Send a standard ecommerce event without ever affecting the shopping flow.
 * No-ops on excluded devices (owner/staff/test — mr-ads-off=1, see
 * minirue-dashboard#111), on top of the base-code guard in app/layout.tsx:
 * this also covers the case where fbq somehow got defined before the cookie
 * was set (e.g. a stale queue from an earlier load).
 */
export function trackMetaPixelEvent(
  name: MetaStandardEvent,
  params: Record<string, unknown>,
  eventId: string,
): void {
  try {
    if (!META_PIXEL_ID || typeof window === 'undefined') return;
    if (isAdsOff()) return;
    window.fbq?.('track', name, params, { eventID: eventId });
  } catch {
    // Advertising telemetry must never break the storefront.
  }
}

/**
 * Meta's base code, verbatim from Events Manager, with the ID filled in —
 * wrapped so it never initialises (never defines window.fbq, never loads
 * fbevents.js) on an excluded device. Must be a source-level guard, not a
 * post-hoc no-op: this runs in <head>, before hydration, and the promise to
 * excluded devices is that the pixel never starts (minirue-dashboard#111).
 */
export function metaPixelBaseCode(id: string): string {
  return `if(${ADS_OFF_INLINE_CHECK}){
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${id}');
fbq('track', 'PageView');
}`;
}
