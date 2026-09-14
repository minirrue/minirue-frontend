/**
 * Meta (Facebook) Pixel ID. The shop's own pixel is the default;
 * NEXT_PUBLIC_META_PIXEL_ID overrides it (build-time, so redeploy after
 * changing it). Anything that is not all digits disables the pixel rather
 * than being interpolated into an inline script.
 */
const raw = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || '1734924024399668';

export const META_PIXEL_ID: string | null = /^\d+$/.test(raw) ? raw : null;

/** Meta's base code, verbatim from Events Manager, with the ID filled in. */
export function metaPixelBaseCode(id: string): string {
  return `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${id}');
fbq('track', 'PageView');`;
}
