import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import UploadPreviewImage from '@/components/storefront/UploadPreviewImage';

/**
 * #11, the half #45 deliberately left behind: `UploadPreviewImage`'s REMOTE
 * branch now goes through `/_next/image` — but only when the call site has
 * told it how big the picture actually renders.
 *
 * Two invariants pull against each other here and both are load-bearing:
 *
 *  1. the optimizer is the only thing on this path that emits AVIF at a
 *     quality we choose (#33/#34: taking it away cost 1.4s of LCP), so the
 *     sized call sites must actually reach it;
 *  2. this component exists because a dashboard-replaced picture lands on a
 *     brand-new uuid-suffixed key whose FIRST request is a guaranteed cold
 *     miss, and one transient failure used to leave a tile broken for every
 *     shopper. Nothing added for (1) may cost that.
 *
 * The third case — no size information at all — is a deliberate non-conversion,
 * not a gap: `ChatPanel`'s attachment thumbnails are `maxWidth/maxHeight: 200`
 * over an image of unknown aspect, so there is no honest width to declare.
 */
const SRC = 'https://cdn.example.com/uploads/tile-9f3a.jpg';
const SIZES = '(max-width: 500px) calc(100vw - 40px), 320px';

describe('UploadPreviewImage — the remote branch and the optimizer', () => {
  it('sends a fluid call site through the optimizer, carrying its sizes', () => {
    render(<UploadPreviewImage src={SRC} alt="A tile" fill sizes={SIZES} />);

    const img = screen.getByAltText('A tile') as HTMLImageElement;
    expect(img.src).toContain('/_next/image');
    expect(img.src).toContain(encodeURIComponent(SRC));
    // `sizes` is the whole point: without it Next assumes full viewport width
    // and a 308px category tile pulls the 1920px rung — strictly worse than
    // the raw tag this replaced.
    expect(img.getAttribute('sizes')).toBe(SIZES);
    // And it has to produce a real ladder, not one file.
    expect(img.getAttribute('srcset') ?? '').toContain('w,');
  });

  it('sends a fixed call site through the optimizer at its pixel count, with no sizes guesswork', () => {
    render(<UploadPreviewImage src={SRC} alt="A logo" width={56} height={56} />);

    const img = screen.getByAltText('A logo') as HTMLImageElement;
    expect(img.src).toContain('/_next/image');
    expect(img.src).toContain('q=75');
    expect(img.width).toBe(56);
  });

  it('leaves a call site with no honest width exactly as it was — a plain tag on the original URL', () => {
    // ChatPanel's shape. Converting this would mean inventing a width, which
    // is the failure mode the whole exercise is avoiding.
    render(<UploadPreviewImage src={SRC} alt="Attachment" style={{ maxWidth: 200 }} />);

    const img = screen.getByAltText('Attachment') as HTMLImageElement;
    expect(img.src).toBe(SRC);
    expect(img.src).not.toContain('/_next/image');
  });
});

describe('UploadPreviewImage — never a broken frame', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('falls back to the original URL on a plain tag when the optimizer refuses', () => {
    // The case that actually happens: `/_next/image` answers 400 for any host
    // outside `images.remotePatterns`, and the live imgproxy host is a backend
    // deploy variable in neither repository.
    render(<UploadPreviewImage src={SRC} alt="A tile" fill sizes={SIZES} />);
    fireEvent.error(screen.getByAltText('A tile'));

    const img = screen.getByAltText('A tile') as HTMLImageElement;
    expect(img.src).toBe(SRC);
    // Still a picture, not the retry affordance — the optimizer saying no is
    // not the image being unavailable.
    expect(screen.queryByText(/tap to retry/i)).not.toBeInTheDocument();
  });

  it('keeps the absolute fill geometry on the fallback tag, so degrading never reflows the tile', () => {
    render(<UploadPreviewImage src={SRC} alt="A tile" fill sizes={SIZES} />);
    fireEvent.error(screen.getByAltText('A tile'));

    const img = screen.getByAltText('A tile') as HTMLImageElement;
    expect(img.style.position).toBe('absolute');
    expect(img.style.width).toBe('100%');
    expect(img.style.height).toBe('100%');
  });

  it('still retries the cold URL with backoff once the direct fallback fails too', () => {
    render(<UploadPreviewImage src={SRC} alt="A tile" fill sizes={SIZES} />);

    fireEvent.error(screen.getByAltText('A tile')); // optimizer says no
    fireEvent.error(screen.getByAltText('A tile')); // the direct URL fails too
    act(() => {
      jest.advanceTimersByTime(600);
    });

    // The cache-busting retry this component has always done, unchanged — and
    // it goes back through the optimizer, because a cold upstream that has
    // since warmed is exactly the case worth re-optimizing.
    const retried = screen.getByAltText('A tile') as HTMLImageElement;
    expect(decodeURIComponent(retried.src)).toContain(`${SRC}?retry=1`);
    expect(screen.queryByText(/tap to retry/i)).not.toBeInTheDocument();
  });

  it('ends at the same tap-to-retry affordance after five failed attempts, never an empty box', () => {
    render(<UploadPreviewImage src={SRC} alt="A tile" fill sizes={SIZES} />);

    for (let i = 0; i < 5; i += 1) {
      const el = screen.queryByAltText('A tile');
      if (!el) break;
      fireEvent.error(el); // optimizer
      const direct = screen.queryByAltText('A tile');
      if (direct) fireEvent.error(direct); // direct URL
      act(() => {
        jest.advanceTimersByTime(60_000);
      });
    }

    expect(screen.getByText(/tap to retry/i)).toBeInTheDocument();
  });

  it('shows the customer their own bytes first, and never routes a blob: URL at the optimizer', () => {
    const file = new Blob(['x'], { type: 'image/jpeg' });
    render(
      <UploadPreviewImage src={SRC} alt="My photo" localFile={file} width={72} height={72} />,
    );

    const img = screen.getByAltText('My photo') as HTMLImageElement;
    expect(img.src).toMatch(/^blob:/);
    // `/_next/image` would have to fetch these bytes from a server that has
    // never seen them.
    expect(img.src).not.toContain('/_next/image');
  });
});
