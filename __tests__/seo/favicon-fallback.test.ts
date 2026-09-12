import { existsSync } from 'node:fs';
import { join } from 'node:path';
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

  it('puts the opaque tile first, because Safari ignores media on icons', () => {
    /*
     * Order is priority: a browser takes the first entry it can use, and
     * Safari ignores `media` on icon links entirely. So the first entry has to
     * be the one that is safe when nobody is choosing.
     *
     * That is `apple-touch-icon.png` — a fully opaque near-black tile with a
     * light mark on it, which reads against a light OR a dark chrome. The
     * white-on-transparent `.ico` does not: it vanishes against the light tab
     * strip that is the default in every desktop browser.
     */
    const urls = iconUrls(null);

    expect(urls[0]).toBe('/apple-touch-icon.png');
    expect(urls.indexOf('/apple-touch-icon.png')).toBeLessThan(
      urls.indexOf('/favicon.ico'),
    );
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

    expect(urls).toContain('/apple-touch-icon.png');
    expect(urls).toContain('/favicon.ico');
    expect(urls).toContain('/icon.png');
    expect(urls.length).toBe(4);
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


describe('the two marks, and which chrome gets which (#12)', () => {
  /*
   * Measured against the live site rather than guessed.
   *
   * The issue said "black mark invisible on dark browser chrome — use the white
   * version". The premise is INVERTED. `favicon.ico` has zero pixels below
   * luminance 96 (histogram of its 32x32 frame, opaque pixels only; mean 228,
   * corner alpha 0) — it is already a near-white mark on transparency, so it
   * disappears against a LIGHT tab strip, which is every desktop browser's
   * default.
   *
   * `apple-touch-icon.png` is its opposite and its answer: fully opaque, mean
   * luminance 4.8, with 1.5% of its pixels above 159 — a light mark on a near
   * black tile. A solid tile reads against either chrome.
   *
   * Both marks already existed. This is which one each chrome gets.
   */
  function iconEntries(faviconUrl?: string | null) {
    const icons = buildIcons(faviconUrl) as { icon?: unknown };
    const entries = Array.isArray(icons.icon) ? icons.icon : [icons.icon];
    return entries as Array<{ url?: string; media?: string }>;
  }

  it('gives dark chrome the white mark, and only dark chrome', () => {
    const ico = iconEntries(null).find((e) => e.url === '/favicon.ico');

    expect(ico?.media).toBe('(prefers-color-scheme: dark)');
  });

  it('leaves the opaque tile unqualified, so it is the default everywhere', () => {
    // A media query on this one would leave light-mode Safari — which ignores
    // media — with nothing it was told to prefer, and it would fall through to
    // the transparent mark that started this.
    const tile = iconEntries(null).find(
      (e) => e.url === '/apple-touch-icon.png',
    );

    expect(tile?.media).toBeUndefined();
  });

  it('leaves the large PNG unqualified too', () => {
    // It is for bookmarks and install prompts, not the tab strip, and both
    // chromes want it.
    const large = iconEntries(null).find((e) => e.url === '/icon.png');

    expect(large?.media).toBeUndefined();
  });

  it('still lets a configured favicon win outright', () => {
    // A shop that has uploaded its own mark has made the choice; the committed
    // files are the floor beneath it, not competition for it.
    const entries = iconEntries('https://img.example.com/shop-favicon.png');

    expect(entries[0].url).toBe('https://img.example.com/shop-favicon.png');
    expect(entries[0].media).toBeUndefined();
  });

  it('keeps the apple entry pointing at the tile as well', () => {
    // Same file, two jobs: the iOS home-screen icon and the light-chrome
    // favicon. Listing it twice is correct — `apple` and `icon` are different
    // link relations and browsers read them for different things.
    const icons = buildIcons(null) as { apple?: unknown };

    expect(icons.apple).toBe('/apple-touch-icon.png');
  });
});

describe('nothing injects an icon ahead of this list', () => {
  /*
   * The part that makes the media split actually work, and the part that is
   * easiest to undo by accident.
   *
   * Next's `app/favicon.ico` FILE CONVENTION emits its own <link rel="icon">
   * BEFORE anything from `metadata.icons`. While that file existed, the
   * rendered head began:
   *
   *     <link rel="icon" href="/favicon.ico?favicon.3uyqo3ztslbh1.ico" ...>
   *     <link rel="icon" href="/apple-touch-icon.png" ...>
   *
   * — so every browser took the white-on-transparent mark first and the whole
   * ordering below it was decoration. Order is priority.
   *
   * The file moved to `public/favicon.ico`, which serves the same URL as a
   * plain static asset and injects nothing. Dropping it back into `app/` would
   * silently restore the bug, with every test above still green, which is why
   * this checks the filesystem.
   */
  const APP_ICONS = ['favicon.ico', 'icon.png', 'icon.svg', 'apple-icon.png'];

  it('keeps favicon.ico out of app/, where the file convention would grab it', () => {
    expect(existsSync(join(process.cwd(), 'app/favicon.ico'))).toBe(false);
  });

  it('still serves /favicon.ico from public/', () => {
    // The dark-mode entry points at it. Moving the file without moving the URL
    // would leave that entry aimed at a 404.
    expect(existsSync(join(process.cwd(), 'public/favicon.ico'))).toBe(true);
  });

  it('allows app/icon.png, which is named in the list and so is ordered by it', () => {
    // Not every file-convention icon is a problem: this one IS the list's last
    // entry, so the convention and the metadata agree. Stated so the rule reads
    // as "do not let an UNLISTED icon jump the queue" rather than "never use
    // the convention".
    const present = APP_ICONS.filter((f) =>
      existsSync(join(process.cwd(), 'app', f)),
    );

    expect(present).toEqual(['icon.png']);
  });
});
