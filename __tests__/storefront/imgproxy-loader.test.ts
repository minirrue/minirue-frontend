import fs from 'node:fs';
import path from 'node:path';
import { imgproxyLoader } from '@/lib/images/imgproxy-loader';

/**
 * The hero stops sending one file to every viewport (#11, and half of #7).
 *
 * It shipped `unoptimized`, so a 390px phone downloaded the same up-to-3200px
 * image as a 2560px desktop — the largest thing on the page and the first thing
 * a shopper waits for.
 *
 * The obvious fix is to drop `unoptimized` and let Next resize. That has a trap
 * worth stating, because it is why this is a LOADER and not a one-word deletion:
 * Next's own optimizer enforces `remotePatterns`, and the imgproxy host comes
 * from a deploy variable that is in neither repository. Get it wrong and every
 * hero image throws at request time in production. With a custom loader Next
 * proxies nothing — it asks the function for a URL per width.
 */

const SRC = 'https://img.example.com/hero-default.webp';
const SRC_SET = {
  '640': 'https://img.example.com/hero-640.webp',
  '1024': 'https://img.example.com/hero-1024.webp',
  '1600': 'https://img.example.com/hero-1600.webp',
  '2560': 'https://img.example.com/hero-2560.webp',
};

const load = (
  srcSet: Record<string, string> | null | undefined,
  width: number,
) => imgproxyLoader(srcSet)({ src: SRC, width, quality: 75 });

describe('imgproxyLoader', () => {
  it('gives a phone the small render', () => {
    expect(load(SRC_SET, 640)).toBe(SRC_SET['640']);
  });

  it('gives a large display the big one', () => {
    expect(load(SRC_SET, 2560)).toBe(SRC_SET['2560']);
  });

  it('rounds UP to the next rung, never down', () => {
    // The direction is the whole point. Downscaling a slightly larger render is
    // invisible; upscaling a smaller one is the pixelation this exists to
    // remove.
    expect(load(SRC_SET, 700)).toBe(SRC_SET['1024']);
    expect(load(SRC_SET, 1025)).toBe(SRC_SET['1600']);
  });

  it('takes a rung exactly when the width matches one', () => {
    expect(load(SRC_SET, 1024)).toBe(SRC_SET['1024']);
  });

  it('falls back to the largest beyond the top rung', () => {
    // A display wider than anything rendered gets the biggest there is, which
    // is the same file the page serves today.
    expect(load(SRC_SET, 4096)).toBe(SRC_SET['2560']);
  });

  it('returns the original src when the server sent no widths', () => {
    // An older payload, or a slide with no image. The hero must keep working,
    // not render nothing.
    expect(load(null, 1024)).toBe(SRC);
    expect(load(undefined, 1024)).toBe(SRC);
    expect(load({}, 1024)).toBe(SRC);
  });

  it('ignores a key that is not a width', () => {
    // The map comes off the wire. A malformed key must not become a URL a
    // browser then tries to load.
    expect(load({ nonsense: 'https://img.example.com/bad.webp' }, 800)).toBe(SRC);
  });
});

describe('the hero never sets a loader and unoptimized together', () => {
  /*
   * `unoptimized` makes next/image ignore the loader entirely, so setting both
   * would leave the hero quietly serving one file while looking fixed. The two
   * are spread from one conditional for exactly that reason, and this reads the
   * component to keep them mutually exclusive.
   */
  const source = fs.readFileSync(
    path.join(process.cwd(), 'components/storefront/SlideContent.tsx'),
    'utf8',
  );

  it('spreads one or the other, never both', () => {
    expect(source).toMatch(
      /\{\.\.\.\(hasSrcSet[\s\S]{0,200}?unoptimized: true \}\)\}/,
    );
  });

  it('does not set a bare `unoptimized` prop anywhere', () => {
    // A stray one would win over the conditional and undo this silently.
    expect(source).not.toMatch(/^\s*unoptimized$/m);
  });
});

describe('the product gallery uses it too, on the LCP element', () => {
  /*
   * Measured with Playwright's own Chromium, Pixel 5, 4x CPU, Slow 4G, against
   * the live product page:
   *
   *     2680 ms   <P>
   *     3744 ms   <IMG>   /_next/image?url=https%3A%2F%2Fimg.minirueshop.com%2F...
   *
   * The product photo IS the LCP element, and every millisecond of that wait
   * was a browser going browser -> Next -> imgproxy -> Garage and back, plus a
   * server-side re-encode at q=75 of a render imgproxy had already made at q=95
   * (#7).
   *
   * The hero stopped taking that hop in #29. This is the same fix on the image
   * that actually decides the page's LCP — which is why the loader is no longer
   * called `heroImageLoader`.
   */
  const source = fs.readFileSync(
    path.join(process.cwd(), 'components/storefront/ProductGallery.tsx'),
    'utf8',
  );

  it('spreads the loader only, and falls back to nothing at all', () => {
    /*
     * The hero's rule does NOT transfer here, and this is the test that pins
     * the difference.
     *
     * The hero already shipped `unoptimized`, so falling back to it changes
     * nothing for a client whose backend sends no widths. This gallery's status
     * quo is `/_next/image`, which is slow but does emit a real srcset. Falling
     * back to `unoptimized` would hand a 390px phone the full 1400x1750 render
     * — a regression, paid by exactly the clients the fix has not reached yet.
     *
     * So the alternative branch is empty. Every deploy either gets the loader
     * or gets what it has today, and no ordering of the two deploys makes
     * anybody slower.
     */
    expect(source).toMatch(
      /\{\.\.\.\(hasSrcSet \? \{ loader: imgproxyLoader\(m\.srcSet\) \} : \{\}\)\}/,
    );
  });

  it('never sets unoptimized, as a prop or in a spread', () => {
    /*
     * Both forms, because they fail the same way and look different:
     * `unoptimized` bare, and `unoptimized: true` inside the spread. The word
     * still appears in the component's own comment explaining why it is absent,
     * so this matches the syntax rather than the word.
     */
    expect(source).not.toMatch(/^\s*unoptimized(\s*=|\s*\/?>|$)/m);
    expect(source).not.toMatch(/unoptimized\s*:/);
  });

  it('only switches on a NON-EMPTY srcSet', () => {
    /*
     * An older backend sends no `srcSet`, and a video or a dead gallery item
     * sends null. A truthiness check alone would also pass for `{}` — which is
     * truthy — and hand the loader a map with no rungs, so every width would
     * fall back to the one fixed `src` and the srcset would be a lie.
     */
    expect(source).toMatch(/Object\.keys\(m\.srcSet\)\.length > 0/);
  });

  it('keeps the first image priority, which is what makes it the LCP', () => {
    // Removing the proxy hop helps only if the browser starts the request
    // early. `priority` is what puts it in the preload scanner.
    expect(source).toContain('priority={i === 0}');
  });
});
