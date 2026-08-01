import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * The real storefront session cookies, httpOnly and set by the backend. Named
 * here rather than imported so the storefront takes no build-time dependency on
 * the API package — the same convention as `app/account/layout.tsx`, which
 * asserts them against the backend's constants in
 * `__tests__/auth/account-gate-uses-real-cookie.test.ts`.
 */
const ACCESS_COOKIE = 'mr_access';
const REFRESH_COOKIE = 'mr_refresh';
const AUTH_HINT_COOKIE = 'mr-auth';

/**
 * Keeps an already-signed-in visitor off /login and /signup.
 *
 * `proxy.ts` already does this, and this is not redundant with it. The proxy
 * runs on a different HOST from the API, so the only thing it can read is
 * `mr-auth` — a non-httpOnly hint the client sets itself, and one that any 401
 * on any request used to clear. When that happened the shopper was still
 * genuinely signed in (server components rendered their profile perfectly well)
 * but the sign-in and sign-up screens opened for them anyway, which is how a
 * second session gets minted over a live one: a fresh token pair, a fresh
 * refresh row, and the previous access token's `sid` left pointing at a row
 * that rotation then revokes.
 *
 * This component has no such problem. It is a Server Component on
 * minirueshop.com, and the real credential is scoped to `.minirueshop.com`, so
 * `cookies()` can read the httpOnly cookie the proxy cannot. Presence, not
 * validity — proving validity means a round trip on every visit, and being
 * wrong here costs a redirect, not access to anything.
 *
 * REFRESH first: the access cookie's life is JWT_ACCESS_EXPIRY, but the refresh
 * cookie's life IS the session's, so gating on access alone would let someone
 * with a live session back onto the sign-in form the moment their access token
 * aged out. `/forgot` and `/reset-password` deliberately do NOT use this —
 * someone signed in on one device may legitimately be resetting a password they
 * no longer trust.
 */
export default function GuestOnly({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <GuestGate>{children}</GuestGate>
    </Suspense>
  );
}

async function GuestGate({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const signedIn =
    jar.has(REFRESH_COOKIE) || jar.has(ACCESS_COOKIE) || jar.has(AUTH_HINT_COOKIE);

  if (signedIn) {
    // Not `next` from the query string: this is the already-signed-in case, so
    // there is no interrupted journey to resume. Home is where a shopper who
    // asked for a sign-in form they do not need should end up.
    redirect('/');
  }

  return <>{children}</>;
}
