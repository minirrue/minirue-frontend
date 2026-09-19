import { ADS_OFF_INLINE_CHECK, isAdsOff } from './ads-off';

const raw = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID?.trim() || 'DALS583C77U9262DR9Q0';
export const TIKTOK_PIXEL_ID: string | null = /^[A-Za-z0-9]+$/.test(raw) ? raw : null;

declare global {
  interface Window { ttq?: { track?: (name: string, properties?: Record<string, unknown>, options?: Record<string, unknown>) => void; page?: () => void } }
}

/**
 * No-ops on excluded devices (owner/staff/test — mr-ads-off=1, see
 * minirue-dashboard#111), on top of the base-code guard below.
 */
export function trackTikTokEvent(name: string, properties: Record<string, unknown> = {}, eventId?: string): void {
  try {
    if (!TIKTOK_PIXEL_ID || typeof window === 'undefined') return;
    if (isAdsOff()) return;
    window.ttq?.track?.(name, properties, eventId ? { event_id: eventId } : undefined);
  } catch { /* marketing telemetry must never break checkout */ }
}

/**
 * TikTok's base code, wrapped so it never initialises (never defines
 * window.ttq, never loads events.js) on an excluded device — same contract
 * as metaPixelBaseCode in ./meta-pixel.ts.
 */
export function tiktokPixelBaseCode(id: string): string {
  return `if(${ADS_OFF_INLINE_CHECK}){!function (w, d, t) { w.TiktokAnalyticsObject=t; var ttq=w[t]=w[t]||[]; ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"]; ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}; for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]); ttq.load=function(e){var n=document.createElement("script");n.type="text/javascript";n.async=!0;n.src="https://analytics.tiktok.com/i18n/pixel/events.js?sdkid="+e+"&lib="+t;var r=document.getElementsByTagName("script")[0];r.parentNode.insertBefore(n,r)}; ttq.load('${id}'); ttq.page(); }(window, document, 'ttq');}`;
}
