/**
 * @jest-environment node
 */
/**
 * Unit tests — proxy.ts
 * Covers: mr-vid minted once (not re-minted when present), set on the
 * redirect branch too, and skipped entirely for a non-HTML accept header.
 * Also covers the readable mirror `mr-vid-c` (backend#224 / frontend#188):
 * kept in sync with mr-vid, reused to rescue mr-vid when the latter is
 * cleared, and the `x-mr-vid` header fallback when neither cookie survives.
 */
import { NextRequest } from 'next/server';
import proxy from '@/proxy';

const VALID_UUID = 'b6f1c3f0-9a3b-4e3a-9a6c-1a2b3c4d5e6f';
const OTHER_VALID_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function makeRequest(
  path: string,
  opts: { cookie?: string; accept?: string; headers?: Record<string, string> } = {},
): NextRequest {
  const headers: Record<string, string> = {
    accept: opts.accept ?? 'text/html,application/xhtml+xml',
    ...opts.headers,
  };
  if (opts.cookie) headers.cookie = opts.cookie;
  return new NextRequest(new URL(path, 'https://minirueshop.com'), { headers });
}

describe('proxy — visitor id + attribution cookies', () => {
  it('mints mr-vid on a plain HTML request when absent', () => {
    const res = proxy(makeRequest('/'));
    const vid = res.cookies.get('mr-vid');
    expect(vid).toBeDefined();
    expect(vid?.value.length).toBeGreaterThan(0);
    expect(vid?.httpOnly).toBe(true);
  });

  it('does not re-mint mr-vid when one already exists', () => {
    const res = proxy(makeRequest('/', { cookie: 'mr-vid=existing-visitor-id' }));
    const setCookie = res.cookies.get('mr-vid');
    // No new Set-Cookie for mr-vid should be issued.
    expect(setCookie).toBeUndefined();
  });

  it('sets mr-vid on the redirect branch — a bounced visitor still gets an id', () => {
    // This used to bounce a GUEST off /account. That gate moved into
    // app/account/layout.tsx, a Server Component that can read the real
    // httpOnly cookie, because gating in the proxy meant trusting the
    // forgeable `mr-auth` hint. The redirect branch that remains here is the
    // opposite one — an already-signed-in visitor kept off /login — and the
    // point of this test is unchanged: whichever branch redirects, the
    // visitor id must still be minted on it.
    const res = proxy(makeRequest('/login', { cookie: 'mr-auth=1' }));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/account');
    const vid = res.cookies.get('mr-vid');
    expect(vid).toBeDefined();
  });

  it('skips every cookie for a non-HTML accept header (crawlers, robots.txt)', () => {
    const res = proxy(makeRequest('/robots.txt', { accept: 'text/plain' }));
    expect(res.cookies.get('mr-vid')).toBeUndefined();
    expect(res.cookies.get('mr-attr-last')).toBeUndefined();
  });

  it('writes attribution cookies only when a utm param or cross-site referer is present', () => {
    const noSignal = proxy(makeRequest('/'));
    expect(noSignal.cookies.get('mr-attr-last')).toBeUndefined();

    const withUtm = proxy(makeRequest('/?utm_source=newsletter&utm_medium=email'));
    const last = withUtm.cookies.get('mr-attr-last');
    expect(last).toBeDefined();
    expect(last?.httpOnly).toBe(true);

    const pub = withUtm.cookies.get('mr-attr-pub');
    expect(pub).toBeDefined();
    expect(pub?.httpOnly).toBe(false);
    expect(pub?.value).toBe(last?.value);
  });

  it('writes mr-attr-first only once, never overwriting an existing value', () => {
    const withUtm = proxy(makeRequest('/?utm_source=first-touch'));
    const first = withUtm.cookies.get('mr-attr-first');
    expect(first).toBeDefined();

    const again = proxy(
      makeRequest('/?utm_source=second-touch', { cookie: 'mr-attr-first=already-set' }),
    );
    expect(again.cookies.get('mr-attr-first')).toBeUndefined();
    // mr-attr-last still overwrites every time a signal is present.
    expect(again.cookies.get('mr-attr-last')).toBeDefined();
  });

  describe('mr-vid-c mirror + rescue (backend#224 / frontend#188)', () => {
    it('cookie present: backfills the mirror to match, id unchanged', () => {
      const res = proxy(makeRequest('/', { cookie: `mr-vid=${VALID_UUID}` }));
      // mr-vid is untouched — no new Set-Cookie for it.
      expect(res.cookies.get('mr-vid')).toBeUndefined();
      const mirror = res.cookies.get('mr-vid-c');
      expect(mirror).toBeDefined();
      expect(mirror?.value).toBe(VALID_UUID);
      expect(mirror?.httpOnly).toBe(false);
    });

    it('cookie present and mirror already matches: no redundant Set-Cookie for the mirror', () => {
      const res = proxy(
        makeRequest('/', { cookie: `mr-vid=${VALID_UUID}; mr-vid-c=${VALID_UUID}` }),
      );
      expect(res.cookies.get('mr-vid')).toBeUndefined();
      expect(res.cookies.get('mr-vid-c')).toBeUndefined();
    });

    it('mr-vid cleared but mirror present: reuses the mirror id instead of minting, re-sets mr-vid', () => {
      const res = proxy(makeRequest('/', { cookie: `mr-vid-c=${VALID_UUID}` }));
      const vid = res.cookies.get('mr-vid');
      expect(vid?.value).toBe(VALID_UUID);
      expect(vid?.httpOnly).toBe(true);
      // Mirror already carries the right value — no redundant re-set.
      expect(res.cookies.get('mr-vid-c')).toBeUndefined();
    });

    it('mr-vid and mirror both cleared, but x-mr-vid header present and valid: reuses the header id', () => {
      const res = proxy(
        makeRequest('/', { headers: { 'x-mr-vid': VALID_UUID } }),
      );
      const vid = res.cookies.get('mr-vid');
      expect(vid?.value).toBe(VALID_UUID);
      const mirror = res.cookies.get('mr-vid-c');
      expect(mirror?.value).toBe(VALID_UUID);
    });

    it('rejects a malformed x-mr-vid header and mints fresh instead', () => {
      const res = proxy(
        makeRequest('/', { headers: { 'x-mr-vid': 'not-a-uuid; DROP TABLE visitors' } }),
      );
      const vid = res.cookies.get('mr-vid');
      expect(vid?.value).toBeDefined();
      expect(vid?.value).not.toBe('not-a-uuid; DROP TABLE visitors');
    });

    it('rejects a malformed mr-vid-c mirror cookie and mints fresh instead', () => {
      const res = proxy(makeRequest('/', { cookie: 'mr-vid-c=not-a-uuid' }));
      const vid = res.cookies.get('mr-vid');
      expect(vid?.value).toBeDefined();
      expect(vid?.value).not.toBe('not-a-uuid');
    });

    it('genuinely fresh browser: mints a new id and sets both cookies to the same value', () => {
      const res = proxy(makeRequest('/'));
      const vid = res.cookies.get('mr-vid');
      const mirror = res.cookies.get('mr-vid-c');
      expect(vid?.value).toBeDefined();
      expect(mirror?.value).toBe(vid?.value);
      expect(vid?.value).not.toBe(OTHER_VALID_UUID);
    });

    it('mirror takes priority over the header when both are present', () => {
      const res = proxy(
        makeRequest('/', {
          cookie: `mr-vid-c=${VALID_UUID}`,
          headers: { 'x-mr-vid': OTHER_VALID_UUID },
        }),
      );
      expect(res.cookies.get('mr-vid')?.value).toBe(VALID_UUID);
    });
  });

  it.each([
    'utm_source=instagram&utm_medium=bio',
    'fbclid=facebook-click',
    'gclid=google-click',
    'ttclid=tiktok-click',
  ])('tracking query %s never changes the signed-in routing decision', (query) => {
    const res = proxy(makeRequest(`/?${query}`, { cookie: 'mr-auth=7' }));

    // These are attribution inputs, not auth inputs. A signed-in visitor stays
    // on the requested storefront page and the proxy neither clears nor
    // rewrites the auth hint while recording the campaign visit.
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
    expect(res.cookies.get('mr-auth')).toBeUndefined();
  });
});
