/**
 * @jest-environment node
 */
/**
 * The /account gate moved OUT of the proxy and INTO the account layout.
 *
 * Next.js's own guidance, verbatim: "Always verify authentication and
 * authorization inside each Server Function rather than relying on Proxy
 * alone." The middleware → proxy rename in v16 exists to signal it.
 *
 * Following it fixed a real bug. The proxy runs on a different HOST from the
 * API, so it never receives the httpOnly session cookie and had to gate on
 * `mr-auth` — a hint the client sets itself, and which any 401 cleared with
 * nothing restoring it until the next sign-in. A shopper with a live session
 * was bounced off /account indefinitely while the rest of the app still knew
 * them.
 *
 * `app/account/layout.tsx` is a Server Component on minirueshop.com, and the
 * real credential is scoped to `.minirueshop.com`, so the browser sends it
 * there too — `cookies()` can read the httpOnly cookie the proxy cannot.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import proxy from '@/proxy';

function makeRequest(path: string, opts: { signedIn?: boolean } = {}) {
  const headers: Record<string, string> = {
    accept: 'text/html,application/xhtml+xml',
  };
  if (opts.signedIn) headers.cookie = 'mr-auth=1';
  return new NextRequest(new URL(path, 'https://minirueshop.com'), { headers });
}

describe('the account gate no longer lives in the proxy', () => {
  it('does not bounce a guest off /account — the layout owns that now', () => {
    // Before: the proxy redirected on a missing `mr-auth`, which is exactly
    // how a signed-in shopper got locked out when that flag was lost.
    const res = proxy(makeRequest('/account/profile'));

    expect(res.headers.get('location')).toBeNull();
  });

  it('does not bounce a guest off /orders either', () => {
    const res = proxy(makeRequest('/orders/abc123'));

    expect(res.headers.get('location')).toBeNull();
  });

  it('still keeps a signed-in shopper off /login', () => {
    // The one job `mr-auth` is still trusted with, where being wrong costs a
    // redirect rather than access to anything.
    const res = proxy(makeRequest('/login', { signedIn: true }));

    expect(res.headers.get('location')).toContain('/account');
  });
});

describe('the layout gate reads the REAL cookie, not the hint', () => {
  const layout = readFileSync(
    join(__dirname, '..', '..', 'app', 'account', 'layout.tsx'),
    'utf8',
  );

  it('checks the httpOnly session cookies', () => {
    expect(layout).toContain('mr_access');
    expect(layout).toContain('mr_refresh');
  });

  it('treats the hint as a fallback, never as the primary signal', () => {
    // `mr-auth` is client-set, so it must never be what the gate reads FIRST.
    // It is accepted only when the real pair is invisible — which happens when
    // COOKIE_DOMAIN leaves the httpOnly cookies host-only on the API's origin.
    // Without that fallback the gate is all-or-nothing per environment: one
    // misconfiguration and every shopper loses /account at once.
    const refreshAt = layout.indexOf('REFRESH_COOKIE)');
    const hintAt = layout.indexOf('AUTH_HINT_COOKIE)');
    expect(refreshAt).toBeGreaterThan(-1);
    expect(hintAt).toBeGreaterThan(refreshAt);
  });

  it('prefers the refresh cookie, whose life IS the session', () => {
    // Gating on the access cookie alone would evict a signed-in shopper the
    // moment their access token aged out — the very bug this gate ends.
    expect(layout).toContain('REFRESH_COOKIE');
  });

  it('redirects a signed-out visitor rather than rendering an empty shell', () => {
    expect(layout).toContain('redirect(');
    expect(layout).toContain('/login');
  });

  it('uses the same cookie names the backend actually sets', () => {
    // A cross-app contract. Renaming the cookie in the backend would silently
    // open this gate to everyone — the layout would look for a name nothing
    // sets, find nothing, and redirect every shopper instead. Assert against
    // the backend's own constants rather than trusting two copies to agree.
    const backend = readFileSync(
      join(
        __dirname,
        '..',
        '..',
        '..',
        'minirue-backend',
        'src',
        'auth',
        'utils',
        'auth-cookies.ts',
      ),
      'utf8',
    );

    expect(backend).toContain("ACCESS_COOKIE = 'mr_access'");
    expect(backend).toContain("REFRESH_COOKIE = 'mr_refresh'");
  });
});
