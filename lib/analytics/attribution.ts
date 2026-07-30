/**
 * Reads the client-readable attribution/visitor cookies set by `proxy.ts`
 * and returns headers a later lane can spread into the checkout POST, so
 * attribution and visitor identity travel with an order.
 *
 * `mr-attr-last` / `mr-attr-first` are HttpOnly by design and never reach
 * this code; `mr-attr-pub` is their public mirror, written for exactly this
 * purpose. `mr-vid` is also HttpOnly, so `x-mr-vid` is only present on the
 * rare setup where that changes — this reads it defensively rather than
 * assuming either way.
 */
const ATTR_PUB_COOKIE = 'mr-attr-pub';
const VISITOR_COOKIE = 'mr-vid';

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

export function attributionHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};

  const attr = readCookie(ATTR_PUB_COOKIE);
  if (attr) headers['x-mr-attr'] = attr;

  const vid = readCookie(VISITOR_COOKIE);
  if (vid) headers['x-mr-vid'] = vid;

  return headers;
}
