'use client';

// Auth tokens now live in httpOnly cookies (mr_access / mr_refresh) set by the
// backend — never in localStorage, so an injected script can't read them. The
// only client-visible artifact is a NON-secret "logged in" hint cookie, used by
// the middleware for routing and by the UI to decide what to render. It carries
// no credential value; the backend validates the real httpOnly token on every
// request regardless of this flag.
const FLAG_COOKIE = 'mr-auth';

/**
 * Matches `session.expiresIn` in the backend's `better-auth.config.ts` (7
 * days). The hint must not outlive the session it is hinting about, or the
 * header claims a sign-in that every request then refuses.
 */
const REMEMBER_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/**
 * `1` — this browser session only. `7` — remembered, and the cookie carries a
 * Max-Age to match.
 *
 * The value encodes the choice because `markAuthenticated()` is re-called on
 * every successful authenticated request (see the re-assert in
 * `lib/api/client.ts`), and those callers have no idea what the shopper ticked
 * at sign-in. Without a record here, the first such call after sign-in would
 * silently rewrite a remembered cookie as a session one — which is exactly the
 * bug this replaces, arriving by a slower route.
 */
type AuthFlag = '1' | '7';

function readAuthFlag(): AuthFlag | null {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name !== FLAG_COOKIE) continue;
    const value = rest.join('=');
    if (value === '1' || value === '7') return value;
    // Any other value is a cookie from before this encoding existed. Treat it
    // as a signed-in-this-session hint rather than as absent, so an upgrade
    // does not sign everyone out.
    return value ? '1' : null;
  }
  return null;
}

/**
 * Whether the UI hint cookie says a session exists. NOT a security check — a
 * user can forge this flag, but they still can't forge the signed httpOnly
 * token the backend actually checks.
 */
export function isAuthenticated(): boolean {
  return readAuthFlag() !== null;
}

/**
 * Mark the UI as logged-in after a successful auth response. By this point the
 * backend has already set the httpOnly token cookies; this only flips the
 * client-visible hint.
 *
 * `rememberMe` is what made "Remember me" mean something.
 *
 * The hint used to be written with no Max-Age, which makes it a BROWSER-session
 * cookie: it dies when the window closes, whatever the shopper ticked. Better
 * Auth's own session cookie honoured `rememberMe` correctly and survived, so
 * after a restart the session was alive while the hint was gone. The header
 * rendered SIGN IN for someone who was signed in, and — worse — `/login` and
 * `/signup` stopped being guarded by the proxy's already-signed-in redirect, so
 * signing in again minted a second session on top of the live one. That is the
 * double sign-in the proxy comment says this shop set out to prevent.
 *
 * Omit the argument to KEEP the current choice; pass it only where the shopper
 * actually expressed one (sign-in, sign-up).
 */
export function markAuthenticated(rememberMe?: boolean): void {
  if (typeof document === 'undefined') return;
  const remembered = rememberMe ?? readAuthFlag() === '7';
  const value: AuthFlag = remembered ? '7' : '1';
  const maxAge = remembered ? `; Max-Age=${REMEMBER_MAX_AGE_SECONDS}` : '';
  document.cookie = `${FLAG_COOKIE}=${value}; path=/; SameSite=Lax${maxAge}`;
}

/**
 * Clear the UI hint on logout. The backend clears the httpOnly token cookies
 * via POST /auth/logout.
 */
export function clearAuthFlag(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${FLAG_COOKIE}=; Max-Age=0; path=/`;
}
