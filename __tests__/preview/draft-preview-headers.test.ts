/**
 * Framing policy (#193): the draft preview is the ONE route the dashboard may
 * frame; every other route keeps `frame-ancestors 'none'` + `X-Frame-Options:
 * DENY`. Evaluated through Next's own path matcher against the real config.
 */
import { getPathMatch } from 'next/dist/shared/lib/router/utils/path-match';
import nextConfig from '@/next.config';

type HeaderRule = { source: string; headers: { key: string; value: string }[] };

async function headersFor(pathname: string): Promise<Record<string, string>> {
  const rules = (await nextConfig.headers!()) as HeaderRule[];
  const out: Record<string, string> = {};
  for (const rule of rules) {
    if (getPathMatch(rule.source, { strict: true })(pathname) === false) continue;
    for (const h of rule.headers) out[h.key] = h.value;
  }
  return out;
}

const frameAncestors = (csp: string | undefined) =>
  /frame-ancestors ([^;]*)/.exec(csp ?? '')?.[1];

describe('framing headers', () => {
  it.each(['/', '/shop', '/shop/perfume/oud', '/terms', '/_internal/preview', '/_internal/draft-previewx'])(
    '%s stays unframeable',
    async (path) => {
      const h = await headersFor(path);
      expect(h['X-Frame-Options']).toBe('DENY');
      expect(frameAncestors(h['Content-Security-Policy'])).toBe("'none'");
    },
  );

  it('/_internal/draft-preview may be framed by the dashboard, and only the dashboard', async () => {
    const h = await headersFor('/_internal/draft-preview');
    expect(h['X-Frame-Options']).toBeUndefined();
    expect(frameAncestors(h['Content-Security-Policy'])).toBe(
      'https://dashboard.minirueshop.com http://localhost:3021',
    );
    // The rest of the site's policy still applies to it.
    expect(h['Content-Security-Policy']).toContain("object-src 'none'");
    expect(h['X-Content-Type-Options']).toBe('nosniff');
  });
});
