import nextConfig from '../../next.config';

/**
 * Storefront video has to be allowed to load (#135).
 *
 * The CSP had no `media-src`, so `default-src 'self'` governed every <video>:
 * a hero, journal or product clip is served from object storage on another
 * https host, and Chrome refused it outright ("Media load rejected by URL
 * safety check") — measured on a production build, 0 requests for the clip.
 * A review's local preview plays a `blob:` URL, which was refused the same way.
 */
async function csp(): Promise<string> {
  const rules = await nextConfig.headers!();
  const header = rules[0].headers.find((h) => h.key === 'Content-Security-Policy');
  return header!.value;
}

describe('Content-Security-Policy for media', () => {
  it('lets <video> load from https hosts and blob: previews', async () => {
    const mediaSrc = (await csp()).split(';').map((d) => d.trim()).find((d) => d.startsWith('media-src'));
    expect(mediaSrc).toBeDefined();
    const sources = mediaSrc!.split(/\s+/).slice(1);
    expect(sources).toEqual(expect.arrayContaining(["'self'", 'https:', 'blob:']));
  });

  it('does not open media to plain http or to any host', async () => {
    const mediaSrc = (await csp()).split(';').map((d) => d.trim()).find((d) => d.startsWith('media-src'))!;
    expect(mediaSrc).not.toMatch(/\shttp:|\s\*(\s|$)/);
  });
});
