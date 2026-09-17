const raw = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID?.trim() || 'DALS583C77U9262DR9Q0';
export const TIKTOK_PIXEL_ID: string | null = /^[A-Za-z0-9]+$/.test(raw) ? raw : null;

declare global {
  interface Window { ttq?: { track?: (name: string, properties?: Record<string, unknown>, options?: Record<string, unknown>) => void; page?: () => void } }
}

export function trackTikTokEvent(name: string, properties: Record<string, unknown> = {}, eventId?: string): void {
  try {
    if (!TIKTOK_PIXEL_ID || typeof window === 'undefined') return;
    window.ttq?.track?.(name, properties, eventId ? { event_id: eventId } : undefined);
  } catch { /* marketing telemetry must never break checkout */ }
}

export function tiktokPixelBaseCode(id: string): string {
  return `!function (w, d, t) { w.TiktokAnalyticsObject=t; var ttq=w[t]=w[t]||[]; ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"]; ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}; for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]); ttq.load=function(e){var n=document.createElement("script");n.type="text/javascript";n.async=!0;n.src="https://analytics.tiktok.com/i18n/pixel/events.js?sdkid="+e+"&lib="+t;var r=document.getElementsByTagName("script")[0];r.parentNode.insertBefore(n,r)}; ttq.load('${id}'); ttq.page(); }(window, document, 'ttq');`;
}
