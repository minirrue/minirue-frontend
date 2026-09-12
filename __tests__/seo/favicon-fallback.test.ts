import { buildIcons } from '@/lib/seo/icons';

/**
 * A configured favicon must not be the ONLY favicon (#12).
 *
 * `app/layout.tsx` assigned the whole object when
 * `settings.storefront.faviconUrl` was set:
 *
 *     metadata.icons = { icon: favicon, apple: "/apple-touch-icon.png" };
 *
 * That replaced the list. So configuring any favicon in the dashboard left the
 * site with exactly one icon, at one size, with nothing behind it — a bad
 * upload, a dead link or an expired signed URL had no fallback in any browser
 * at any size.
 *
 * And `app/icon.png` had been inert the whole time: naming `metadata.icons` at
 * all overrides Next's `app/icon.*` file convention, so the 512px file was
 * being served by nothing.
 *
 * This says nothing about WHICH mark is correct — that is the other half of
 * #12, and it needs someone who can see the live setting. It says only that
 * whatever is configured, the committed files stay behind it.
 */

/** The `icon` entry as a flat list of urls, whatever shape it was declared in. */
function iconUrls(faviconUrl?: string | null): string[] {
  const icons = buildIcons(faviconUrl) as { icon?: unknown };
  const entries = Array.isArray(icons.icon) ? icons.icon : [icons.icon];
  return entries
    .map((e) => (typeof e === 'string' ? e : (e as { url?: string })?.url))
    .filter((u): u is string => typeof u === 'string');
}

describe('when no favicon is configured', () => {
  it('serves the committed .ico', () => {
    expect(iconUrls(null)).toContain('/favicon.ico');
  });

  it('also serves the 512px PNG, which the file convention alone would not', () => {
    expect(iconUrls(null)).toContain('/icon.png');
  });

  it('puts the small one first, for the tab strip', () => {
    const urls = iconUrls(null);

    expect(urls.indexOf('/favicon.ico')).toBeLessThan(urls.indexOf('/icon.png'));
  });

  it('is the same for undefined as for null', () => {
    // The settings response can carry either, and a missing key must not
    // produce a different icon set from an explicitly empty one.
    expect(iconUrls(undefined)).toEqual(iconUrls(null));
  });
});

describe('when one is configured', () => {
  const CONFIGURED = 'https://img.example.com/shop-favicon.png';

  it('uses the configured one first, so it still wins', () => {
    // A browser takes the first entry it can use; the rest only matter when it
    // cannot.
    expect(iconUrls(CONFIGURED)[0]).toBe(CONFIGURED);
  });

  it('keeps the committed files behind it', () => {
    // The bug: this list used to be exactly one long.
    const urls = iconUrls(CONFIGURED);

    expect(urls).toContain('/favicon.ico');
    expect(urls).toContain('/icon.png');
    expect(urls.length).toBe(3);
  });

  it('leaves the apple touch icon alone', () => {
    const icons = buildIcons(CONFIGURED) as { apple?: unknown };

    expect(icons.apple).toBe('/apple-touch-icon.png');
  });

  it('does not treat an empty string as a configured icon', () => {
    // A cleared field in the dashboard comes back as '' rather than null, and
    // an empty url in the list would be a broken first choice for every
    // browser that tried it.
    expect(iconUrls('')).toEqual(iconUrls(null));
  });
});
