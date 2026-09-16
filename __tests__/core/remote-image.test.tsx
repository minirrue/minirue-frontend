import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Image from 'next/image';
import RemoteImage from '@/components/ui/RemoteImage';
import nextConfig from '../../next.config';

describe('browser security policy', () => {
  it('allows same-origin geolocation without adding a third-party script origin', async () => {
    const rules = await nextConfig.headers?.();
    const headers = rules?.[0]?.headers ?? [];
    expect(headers.find((item) => item.key === 'Content-Security-Policy')?.value).not.toContain('maps.googleapis.com');
    expect(headers.find((item) => item.key === 'Permissions-Policy')?.value).toContain('geolocation=(self)');
    expect(headers.find((item) => item.key === 'Content-Security-Policy')?.value).toContain("worker-src 'self' blob:");
  });
});

/**
 * #11 — the nine fixed-size remote images that used to be raw `<img>` all
 * render through this. Two things have to be true at once and they pull in
 * opposite directions:
 *
 *  1. the request must go through `/_next/image`, because that is the only
 *     thing on the path that converts to AVIF and applies a quality we chose
 *     (#34 measured 485 KB → 67 KB on a real product image);
 *  2. a failure of the optimizer must never cost the shopper the picture,
 *     because `/_next/image` answers 400 for a host that is not in
 *     `images.remotePatterns` and the live imgproxy host is a backend deploy
 *     variable that is in neither repository.
 *
 * So the optimizer is an enhancement with a plain-tag floor, and `onError`
 * means "this image cannot be shown at all", not "the optimizer said no".
 */
const SRC = 'https://cdn.example.com/pictures/thing.jpg';

describe('RemoteImage', () => {
  it('requests the image through Next\'s optimizer, at the given size and a deliberate quality', () => {
    render(<RemoteImage src={SRC} alt="A thing" width={56} height={70} />);

    const img = screen.getByAltText('A thing') as HTMLImageElement;
    expect(img.src).toContain('/_next/image');
    expect(img.src).toContain(encodeURIComponent(SRC));
    // Deliberate, not inherited (#11's "quality set deliberately"). #153: q=75
    // is AVIF at sharp quality 55, which smeared glitter, gold gradients and
    // label edges and shipped a 384px photo in ~2 KB. 90 is the single value in
    // `images.qualities` (next.config.ts), so the two are pinned together.
    expect(img.src).toContain('q=90');
    expect(img.src).not.toContain('q=75');
  });

  it('#153: a plain next/image with no quality prop is also requested at q=90', () => {
    // The product gallery, cards, nav tiles, search and cart render
    // `next/image` directly and pass no `quality`. They follow the config's
    // closest allowed quality, so one list covers every photo on the site.
    render(<Image src={SRC} alt="Direct" width={384} height={384} />);
    expect((screen.getByAltText('Direct') as HTMLImageElement).src).toContain('q=90');
  });

  it('falls back to the original URL on a plain tag when the optimizer fails', () => {
    const onError = jest.fn();
    render(<RemoteImage src={SRC} alt="A thing" width={56} height={70} onError={onError} />);

    fireEvent.error(screen.getByAltText('A thing'));

    const img = screen.getByAltText('A thing') as HTMLImageElement;
    expect(img.src).toBe(SRC);
    // The caller must NOT have been told the image is unavailable — this is
    // exactly the case (a host outside remotePatterns) where the picture is
    // perfectly fine and only the proxy refused.
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports onError only once the direct URL has failed too', () => {
    const onError = jest.fn();
    render(<RemoteImage src={SRC} alt="A thing" width={56} height={70} onError={onError} />);

    fireEvent.error(screen.getByAltText('A thing'));
    fireEvent.error(screen.getByAltText('A thing'));

    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('re-tries the optimizer when the src changes', () => {
    const { rerender } = render(<RemoteImage src={SRC} alt="A thing" width={56} height={70} />);
    fireEvent.error(screen.getByAltText('A thing'));
    expect((screen.getByAltText('A thing') as HTMLImageElement).src).toBe(SRC);

    // A replaced picture lands on a brand-new key. Inheriting the previous
    // URL's verdict would mean one bad image permanently un-optimizing its
    // successor in the same slot.
    const next = 'https://cdn.example.com/pictures/other.jpg';
    rerender(<RemoteImage src={next} alt="A thing" width={56} height={70} />);

    const img = screen.getByAltText('A thing') as HTMLImageElement;
    expect(img.src).toContain('/_next/image');
    expect(img.src).toContain(encodeURIComponent(next));
  });
});

/**
 * #11's second half. The nine images #45 converted all had a pixel size; the
 * ones behind `UploadPreviewImage` fill a fluid box instead, so they need
 * `fill` plus a `sizes` describing that box. `sizes` is what decides which
 * width the browser actually downloads, so it is required by the type — a
 * `fill` without one makes Next assume full viewport width and a 146px tile
 * would pull the 1920px rung, which is worse than the raw tag it replaced.
 */
/**
 * #153 decided the photo pipeline by measurement (three live photos, three
 * widths, control vs AVIF q90 vs WebP q90 vs imgproxy's own srcset). This pins
 * the result: AVIF first, and 90 as the ONLY allowed quality, so a stray
 * `quality={75}` cannot quietly bring back the soft encode (the optimizer
 * refuses a quality outside the list).
 */
describe('#153 image pipeline config', () => {
  it('encodes photos as AVIF (WebP fallback) at quality 90 only', () => {
    expect(nextConfig.images?.formats).toEqual(['image/avif', 'image/webp']);
    expect(nextConfig.images?.qualities).toEqual([90]);
  });
});

describe('RemoteImage — fill mode', () => {
  const SIZES = '(max-width: 500px) calc(100vw - 40px), 320px';

  it('emits a real width ladder and carries sizes through to the tag', () => {
    render(<RemoteImage src={SRC} alt="A tile" fill sizes={SIZES} />);

    const img = screen.getByAltText('A tile') as HTMLImageElement;
    expect(img.src).toContain('/_next/image');
    expect(img.getAttribute('sizes')).toBe(SIZES);
    // More than one rung, or `sizes` is buying nothing.
    const srcset = img.getAttribute('srcset') ?? '';
    expect(srcset.split(',').length).toBeGreaterThan(1);
  });

  it('keeps the fill geometry on the plain-tag fallback, so degrading does not reflow the box', () => {
    const onError = jest.fn();
    render(<RemoteImage src={SRC} alt="A tile" fill sizes={SIZES} onError={onError} />);

    fireEvent.error(screen.getByAltText('A tile'));

    const img = screen.getByAltText('A tile') as HTMLImageElement;
    expect(img.src).toBe(SRC);
    // `next/image fill` positions itself absolutely inside the (positioned)
    // parent; a fallback that did not would collapse the tile to nothing.
    expect(img.style.position).toBe('absolute');
    expect(img.style.width).toBe('100%');
    expect(img.style.height).toBe('100%');
    // Same two-step contract as the fixed mode: the optimizer refusing is not
    // the image being unavailable.
    expect(onError).not.toHaveBeenCalled();
  });

  it('still reports onError only once the direct URL has failed too', () => {
    const onError = jest.fn();
    render(<RemoteImage src={SRC} alt="A tile" fill sizes={SIZES} onError={onError} />);

    fireEvent.error(screen.getByAltText('A tile'));
    fireEvent.error(screen.getByAltText('A tile'));

    expect(onError).toHaveBeenCalledTimes(1);
  });
});
