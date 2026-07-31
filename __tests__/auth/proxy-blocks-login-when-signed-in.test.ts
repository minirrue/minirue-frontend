/**
 * @jest-environment node
 */
/**
 * Owner: "prohibit visiting /login from next js proxy to prevent double sign
 * in please."
 *
 * Signing in again while already signed in mints a SECOND session on top of a
 * live one — a fresh token pair and a fresh refresh row — and leaves the
 * previous access token's `sid` pointing at a row that rotation then revokes.
 * It is also one way a browser ends up holding two credentials under a single
 * cookie name, which is the shape of the lockout diagnosed on 2026-07-31.
 *
 * Blocking at the edge rather than with a client-side redirect matters: a
 * `useEffect` renders the sign-in form first and only then bounces, so the form
 * is briefly submittable and the flash is visible.
 *
 * The `@jest-environment node` docblock above is load-bearing — `next/server`
 * cannot be imported under jsdom, and without it this file fails to COMPILE
 * and reports "0 tests" while looking green.
 */
import { NextRequest } from 'next/server';
import proxy from '@/proxy';

function makeRequest(
  path: string,
  opts: { signedIn?: boolean } = {},
): NextRequest {
  const headers: Record<string, string> = {
    accept: 'text/html,application/xhtml+xml',
  };
  if (opts.signedIn) headers.cookie = 'mr-auth=1';
  return new NextRequest(new URL(path, 'https://minirueshop.com'), { headers });
}

describe('the edge proxy keeps a signed-in shopper off the auth screens', () => {
  it('redirects /login away when already signed in', () => {
    const res = proxy(makeRequest('/login', { signedIn: true }));

    expect(res.headers.get('location')).toContain('/account');
  });

  it('redirects /signup away when already signed in', () => {
    const res = proxy(makeRequest('/signup', { signedIn: true }));

    expect(res.headers.get('location')).toContain('/account');
  });

  it('honours ?next= so an interrupted journey still lands where it meant to', () => {
    const res = proxy(
      makeRequest('/login?next=%2Faccount%2Fprofile', { signedIn: true }),
    );

    expect(res.headers.get('location')).toContain('/account/profile');
  });

  it('ignores a protocol-relative ?next= rather than sending the shopper off-site', () => {
    // `//evil.example` is a valid URL to another origin. Falling back to
    // /account is the safe reading of an untrusted query parameter.
    const res = proxy(
      makeRequest('/login?next=%2F%2Fevil.example', { signedIn: true }),
    );

    const location = res.headers.get('location') ?? '';
    expect(location).not.toContain('evil.example');
    expect(location).toContain('/account');
  });

  it('leaves /login alone for a guest — that is who it is for', () => {
    const res = proxy(makeRequest('/login'));

    expect(res.headers.get('location')).toBeNull();
  });

  it('still lets a signed-in shopper reset a password they no longer trust', () => {
    // Deliberately not gated: someone signed in on one device may be resetting
    // a password precisely because another device is compromised.
    expect(
      proxy(makeRequest('/forgot', { signedIn: true })).headers.get('location'),
    ).toBeNull();
    expect(
      proxy(makeRequest('/reset-password', { signedIn: true })).headers.get(
        'location',
      ),
    ).toBeNull();
  });

  it('still bounces a guest off a protected route', () => {
    // The mirror rule must keep working.
    const res = proxy(makeRequest('/account/profile'));

    expect(res.headers.get('location')).toContain('/login');
  });
});
