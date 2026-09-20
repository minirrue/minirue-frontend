/**
 * Reads the client-readable attribution/visitor cookies set by `proxy.ts`
 * and returns headers a later lane can spread into the checkout POST, so
 * attribution and visitor identity travel with an order.
 *
 * `mr-attr-last` / `mr-attr-first` are HttpOnly by design and never reach
 * this code; `mr-attr-pub` is their public mirror, written for exactly this
 * purpose. `mr-vid` is also HttpOnly and normally unreadable here — the
 * readable mirror `mr-vid-c` (backend#224 / frontend#188) carries the same
 * uuid and is what this actually reads, falling back to a rescued copy in
 * localStorage (see `syncVisitorIdMirror`/`getVisitorIdForHeader` below) when
 * both cookies have been cleared. This client NEVER mints a visitor id —
 * only the server (`proxy.ts`) does that; a missing id here simply means no
 * `x-mr-vid` header is sent and the server mints on the next response.
 */
const ATTR_PUB_COOKIE = 'mr-attr-pub';
const VISITOR_MIRROR_COOKIE = 'mr-vid-c';
const VISITOR_STORAGE_KEY = 'mr-vid';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: string | null | undefined): value is string {
  return !!value && UUID_PATTERN.test(value);
}

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

/**
 * Call once on load. Copies the readable `mr-vid-c` cookie into
 * `localStorage['mr-vid']` so the id survives a cookie clear that keeps
 * "site data" (localStorage) intact. No-ops when the cookie is absent or
 * not a valid uuid — it never invents an id.
 */
export function syncVisitorIdMirror(): void {
  if (typeof window === 'undefined') return;
  const mirror = readCookie(VISITOR_MIRROR_COOKIE);
  if (!isValidUuid(mirror)) return;
  try {
    window.localStorage.setItem(VISITOR_STORAGE_KEY, mirror);
  } catch {
    // Storage unavailable (private mode, quota) — the cookie mirror is still
    // there for next time the server can read it.
  }
}

/**
 * The id to send as `x-mr-vid` on a collect request, used only when no
 * cookie is readable client-side (both `mr-vid` and its mirror are gone).
 * Reads localStorage, never writes or mints — a rescue read only.
 */
function getVisitorIdFromStorage(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const stored = window.localStorage.getItem(VISITOR_STORAGE_KEY);
    return isValidUuid(stored) ? stored : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The `x-mr-vid` value for an outgoing request, if any. Prefers the readable
 * mirror cookie (fresher — the server just set it); falls back to the
 * localStorage copy only when neither cookie survived. Never mints.
 */
export function getVisitorIdForHeader(): string | undefined {
  const mirror = readCookie(VISITOR_MIRROR_COOKIE);
  if (isValidUuid(mirror)) return mirror;
  return getVisitorIdFromStorage();
}

export function attributionHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};

  const attr = readCookie(ATTR_PUB_COOKIE);
  if (attr) headers['x-mr-attr'] = attr;

  const vid = getVisitorIdForHeader();
  if (vid) headers['x-mr-vid'] = vid;

  return headers;
}
