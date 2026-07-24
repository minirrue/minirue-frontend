'use client';

// Auth tokens now live in httpOnly cookies (mr_access / mr_refresh) set by the
// backend — never in localStorage, so an injected script can't read them. The
// only client-visible artifact is a NON-secret "logged in" hint cookie, used by
// the middleware for routing and by the UI to decide what to render. It carries
// no credential value; the backend validates the real httpOnly token on every
// request regardless of this flag.
const FLAG_COOKIE = 'mr-auth';

/**
 * Whether the UI hint cookie says a session exists. NOT a security check — a
 * user can forge this flag, but they still can't forge the signed httpOnly
 * token the backend actually checks.
 */
export function isAuthenticated(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie
    .split(';')
    .some((c) => c.trim().startsWith(`${FLAG_COOKIE}=1`));
}

/**
 * Mark the UI as logged-in after a successful auth response. By this point the
 * backend has already set the httpOnly token cookies; this only flips the
 * client-visible hint.
 */
export function markAuthenticated(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${FLAG_COOKIE}=1; path=/; SameSite=Lax`;
}

/**
 * Clear the UI hint on logout. The backend clears the httpOnly token cookies
 * via POST /auth/logout.
 */
export function clearAuthFlag(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${FLAG_COOKIE}=; Max-Age=0; path=/`;
}
