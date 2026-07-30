/**
 * @jest-environment node
 */
/**
 * Unit tests — proxy.ts
 * Covers: mr-vid minted once (not re-minted when present), set on the
 * redirect branch too, and skipped entirely for a non-HTML accept header.
 */
import { NextRequest } from 'next/server';
import proxy from '@/proxy';

function makeRequest(
  path: string,
  opts: { cookie?: string; accept?: string } = {},
): NextRequest {
  const headers: Record<string, string> = {
    accept: opts.accept ?? 'text/html,application/xhtml+xml',
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
    const res = proxy(makeRequest('/account'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
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
});
