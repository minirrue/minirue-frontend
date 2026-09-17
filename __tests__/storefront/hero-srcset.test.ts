import fs from 'node:fs';
import path from 'node:path';
import { heroImageLoader } from '@/lib/images/hero-loader';

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
  '3840': 'https://img.example.com/hero-3840.webp',
};

const load = (
  srcSet: Record<string, string> | null | undefined,
  width: number,
) => heroImageLoader(srcSet)({ src: SRC, width, quality: 75 });

describe('heroImageLoader', () => {
  it('gives a phone the small render', () => {
    expect(load(SRC_SET, 640)).toBe(SRC_SET['640']);
  });

  it('gives a large display the big one', () => {
    expect(load(SRC_SET, 2560)).toBe(SRC_SET['2560']);
  });

  it('gives a retina laptop the 3840px rung instead of upscaling 2560px', () => {
    expect(load(SRC_SET, 2880)).toBe(SRC_SET['3840']);
    expect(load(SRC_SET, 3840)).toBe(SRC_SET['3840']);
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
    expect(load(SRC_SET, 4096)).toBe(SRC_SET['3840']);
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

  it('the art-directed <picture> path uses the same one-or-the-other rule', () => {
    // #11: both crops of a photo slide go through getImageProps, which ignores
    // a loader under `unoptimized` exactly like <Image> does.
    expect(source).toMatch(
      /return hasWidths \? \{ loader: heroImageLoader\(srcSet\) \} : \{ unoptimized: true \};/,
    );
    expect(source).toMatch(/src: desktopSrc, \.\.\.heroImageSource\(desktopSrcSet\)/);
    expect(source).toMatch(/src: mobileSrc, \.\.\.heroImageSource\(mobileSrcSet\)/);
  });

  it('does not set a bare `unoptimized` prop anywhere', () => {
    // A stray one would win over the conditional and undo this silently.
    expect(source).not.toMatch(/^\s*unoptimized$/m);
  });
});
