/**
 * Account layout — customer self-service (Role.CUSTOMER)
 * Protection: middleware checks mr-auth cookie on /account/*
 *
 * Cache Components–compatible dynamic-rendering opt-out.
 *
 * - The `await cookies()` call is placed INSIDE the `<Suspense>` boundary
 *   so that the uncached data access lives within a Suspense scope. Reading
 *   the cookie jar here (with a null fallback) empties the static shell for
 *   the entire /account/* subtree and defers every page under it to request
 *   time. This is the recommended pattern for fully-dynamic subtrees per
 *   the Next.js 16 caching docs.
 */
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AccountLayoutClient from './AccountLayoutClient';

/**
 * The REAL storefront session cookies, httpOnly and set by the backend. Named
 * here rather than imported so the storefront does not take a build-time
 * dependency on the API package; they are asserted against the backend's own
 * constants by `__tests__/auth/account-gate-uses-real-cookie.test.ts`.
 */
const ACCESS_COOKIE = 'mr_access';
const REFRESH_COOKIE = 'mr_refresh';

export const metadata: Metadata = {
  title: 'My Account — MiniRue',
  robots: 'noindex, nofollow',
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={null}
    >
      {/*
        Opts the route out of static rendering. middleware has already
        verified the mr-auth cookie — touching the cookie jar here also
        makes this segment dynamic under Cache Components. MUST be inside
        a <Suspense> boundary (with a null fallback) so the static shell
        can be generated and the dynamic part streams at request time.
      */}
      <DynamicShell>
        <AccountLayoutClient>{children}</AccountLayoutClient>
      </DynamicShell>
    </Suspense>
  );
}

/**
 * The account gate, verified HERE rather than in the proxy.
 *
 * Next.js's own guidance, verbatim: "Always verify authentication and
 * authorization inside each Server Function rather than relying on Proxy
 * alone." The `middleware` → `proxy` rename in v16 exists to signal exactly
 * that — "we recommend users avoid relying on Middleware unless no other
 * options exist."
 *
 * Following it is not cosmetic here, it fixes a real class of bug. The proxy
 * runs on a different HOST from the API, so it never receives the httpOnly
 * session cookie and had to gate on `mr-auth` — a non-httpOnly hint the client
 * sets itself. That hint is forgeable in one direction and LOSABLE in the
 * other: any 401 on any request cleared it, and nothing restored it until the
 * next sign-in, so a shopper with a perfectly live session was bounced off
 * /account forever while the rest of the app still knew them ("im still logged
 * in and it redirects me to /login although i can see my profile photo").
 *
 * This layout has no such problem. It is a Server Component on
 * minirueshop.com, and the real credential is scoped to `.minirueshop.com`, so
 * the browser sends it here too — `cookies()` can read the httpOnly cookie the
 * proxy cannot. It is httpOnly, so client code cannot lose or forge it; only
 * the server clears it.
 *
 * This is a presence check, not a validity check, and deliberately so: proving
 * validity means a round trip to /auth/me on every account page load. It does
 * not need to prove validity, because nothing here renders customer data
 * without an authenticated API call that enforces it independently. The job of
 * this gate is to send a signed-out visitor somewhere useful instead of an
 * empty shell — and, unlike the hint, it cannot be wrong about a live session.
 *
 * `cookies()` was already awaited here purely to opt the subtree out of static
 * rendering; its result was thrown away. Now it is also read.
 */
async function DynamicShell({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const hasSession =
    jar.has(ACCESS_COOKIE) || jar.has(REFRESH_COOKIE);

  if (!hasSession) {
    redirect(`/login?next=%2Faccount&reason=sign-in-required`);
  }

  return <>{children}</>;
}
