import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import RemoteImage from '@/components/ui/RemoteImage';

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
    // Deliberate, not inherited (#11's "quality set deliberately"). 75 is the
    // only value in Next 16's default `images.qualities`, so a different one
    // needs next.config.ts changed too — which is why it is pinned here.
    expect(img.src).toContain('q=75');
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
