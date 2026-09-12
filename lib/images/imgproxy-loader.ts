import type { ImageLoaderProps } from 'next/image';

/**
 * A `next/image` loader that picks from widths the SERVER already rendered.
 *
 * Named for what it does rather than where it started. It was
 * `heroImageLoader` in `hero-loader.ts` until the product gallery needed the
 * same thing — and a name describing one caller sends the next reader looking
 * for a hero-specific rule that is not here. Nothing in it is about heroes.
 *
 * The hero shipped `unoptimized`, which means one file for every viewport: a
 * 390px phone downloaded the same up-to-3200px image as a 2560px desktop. It is
 * the largest thing on the page and the first thing a shopper waits for
 * (#11, and half of #7).
 *
 * The obvious fix — drop `unoptimized` and let Next resize — has a trap. Next's
 * own optimizer enforces `remotePatterns`, and the imgproxy host comes from a
 * deploy variable that is in neither repository. Get it wrong and EVERY hero
 * image throws at request time in production. A custom loader sidesteps that
 * entirely: with one, Next does not proxy anything. It asks this function for a
 * URL per width and builds the `srcset` from the answers.
 *
 * The widths cannot be computed here — an imgproxy URL is signed, so only the
 * backend can produce one — which is why the server sends a map rather than a
 * pattern.
 *
 * Nearest at or ABOVE what was asked for, never below: downscaling a slightly
 * larger render is invisible, and upscaling a smaller one is the pixelation
 * this exists to remove. Past the top rung it returns the largest there is,
 * which is the same file the page gets today.
 */
export function imgproxyLoader(
  srcSet: Record<string, string> | null | undefined,
) {
  return ({ src, width }: ImageLoaderProps): string => {
    if (!srcSet) return src;

    const rungs = Object.keys(srcSet)
      .map(Number)
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
    if (rungs.length === 0) return src;

    const chosen = rungs.find((rung) => rung >= width) ?? rungs[rungs.length - 1];
    return srcSet[String(chosen)] ?? src;
  };
}
