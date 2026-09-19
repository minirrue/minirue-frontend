import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductGallery from '@/components/storefront/ProductGallery';
import { carouselMedia } from '@/lib/api/catalog';
import { PRODUCT_FIXTURE } from './fixtures/product';

/**
 * Before this, a phone got a scroll-snap strip with nothing on screen to say a
 * second photograph existed, and a laptop got a stack of full-height slabs.
 */
describe('ProductGallery', () => {
  const items = carouselMedia(PRODUCT_FIXTURE);

  beforeEach(() => {
    jest.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
    jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it('renders one slide and one dot per photograph', () => {
    render(<ProductGallery product={PRODUCT_FIXTURE} items={items} />);

    expect(items).toHaveLength(3);
    expect(screen.getAllByRole('img')).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: /go to media/i })).toHaveLength(3);
  });

  it('starts on the cover and says which photograph you are on', () => {
    render(<ProductGallery product={PRODUCT_FIXTURE} items={items} />);

    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go to media 1 of 3/i })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('moves to the photograph whose dot was pressed', async () => {
    render(<ProductGallery product={PRODUCT_FIXTURE} items={items} />);

    await userEvent.click(screen.getByRole('button', { name: /go to media 3 of 3/i }));

    expect(screen.getByText('3 / 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go to media 3 of 3/i })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  /**
   * #58, revised #185 — the slide is a FIXED ratio on a phone; on a laptop it
   * now takes the PHOTOGRAPH's OWN ratio, capped to the viewport height, so
   * the whole image fits without scrolling and nothing is cropped or
   * letterboxed. The square `lg:aspect-square` box from #58 is gone: it was
   * a fixed shape independent of both the photograph AND the window, so a
   * portrait photo left visible bars on a laptop and — the report that
   * reopened this — a short window (1366x768) made the square itself taller
   * than the space available, requiring the shopper to scroll the page to
   * see the rest of a photo that "fit" by the old rule's own definition.
   */
  describe('the slide box (#58, #185)', () => {
    const slideBoxes = () =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-trace-id^="PG-STOREFRONT-CAT-005::EL-IMG-product-carousel-image@"]',
        ),
      );

    it('keeps 4:5 on a phone — the framing the owner asked not to touch', () => {
      render(<ProductGallery product={PRODUCT_FIXTURE} items={items} />);

      for (const box of slideBoxes()) {
        expect(box.className).toContain('aspect-[4/5]');
      }
    });

    it('takes the photograph\'s own aspect ratio from lg:, capped to the viewport height (#185)', () => {
      render(<ProductGallery product={PRODUCT_FIXTURE} items={items} />);

      const boxes = slideBoxes();
      expect(boxes).toHaveLength(items.length);
      for (const box of boxes) {
        // No fixed lg: ratio class any more — the shape now comes from the
        // per-slide `--mr-gallery-ar` custom property (set from the media's
        // own width/height below), read by a scoped `lg:` rule.
        expect(box.className).not.toContain('lg:aspect-square');
        expect(box.className).toContain('lg:aspect-auto');
        expect(box.className).toContain('mr-gallery-frame');
        // PRODUCT_FIXTURE's media is 1200x1500 — the exact ratio must reach
        // the element as a CSS custom property, not just "some value".
        expect(box.style.getPropertyValue('--mr-gallery-ar')).toBe('1200 / 1500');
      }

      // The height cap itself: `calc(100svh - <header> - <gap>)`, set on the
      // OUTER slide (the actual scroll-snap unit), not the frame — the frame
      // shrinks to fit inside whatever height the slide gives it.
      const slide = boxes[0]?.parentElement as HTMLElement;
      expect(slide.className).toContain('mr-gallery-slide');
      expect(slide.style.getPropertyValue('--mr-gallery-cap-h')).toMatch(/^calc\(100svh - \d+px - \d+px\)$/);
    });

    it('never asks Cloudinary for a width AND a height', () => {
      /**
       * `cloudinaryUrl()` emits no crop mode, so `w_1400,h_1750` is `c_scale`:
       * it does not crop a square source to 4:5, it stretches it. Gallery media
       * arrives pre-resolved and ignores these options entirely — this guards
       * the legacy Cloudinary assets that still fall through to them.
       */
      render(<ProductGallery product={PRODUCT_FIXTURE} items={items} />);

      for (const img of screen.getAllByRole('img')) {
        const src = decodeURIComponent(img.getAttribute('src') ?? '');
        expect(src).not.toMatch(/[,/]h_\d+/);
      }
    });

    it('uses object-cover at every width, and keeps the source WebP (#185)', () => {
      // Once the FRAME (above) takes the photograph's own ratio, `cover` and
      // `contain` render identically — there is nothing left to crop or
      // letterbox either way, so the split `lg:object-contain` is gone too.
      render(<ProductGallery product={PRODUCT_FIXTURE} items={items} />);

      for (const img of screen.getAllByRole('img')) {
        expect(img.className).toContain('object-cover');
        expect(img.className).not.toContain('object-contain');
        // The PDP source is already a high-quality imgproxy WebP. Sending it
        // through Next again made desktop Chrome choose a 21 KB AVIF re-encode.
        expect(img.getAttribute('src')).not.toContain('/_next/image');
      }
    });
  });

  it('shows no dots, counter or arrows for a product with one photograph', () => {
    render(<ProductGallery product={PRODUCT_FIXTURE} items={[items[0]]} />);

    expect(screen.queryByRole('button', { name: /go to media/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /next slide/i })).toBeNull();
    expect(screen.queryByText(/1 \/ 1/)).toBeNull();
  });

  it('uses the shared player for a ready product video', () => {
    const video = {
      ...items[0],
      id: 'video-1',
      url: 'https://storage.minirueshop.com/products/clip.mp4',
      kind: 'video' as const,
      status: 'ready' as const,
      posterUrl: 'https://img.minirueshop.com/products/clip-poster.webp',
      altText: 'Bottle film',
    };

    const { container } = render(<ProductGallery product={PRODUCT_FIXTURE} items={[video]} />);
    const element = container.querySelector('video') as HTMLVideoElement;
    expect(element).toHaveAttribute('src', video.url);
    expect(element).toHaveAttribute('poster', video.posterUrl);
    expect(element).not.toHaveAttribute('controls');
    fireEvent.playing(element);
    expect(screen.getByRole('button', { name: 'Pause video' })).toBeInTheDocument();
  });

  it('keeps a processing product video on its poster', () => {
    const processing = {
      ...items[0],
      id: 'video-processing',
      url: 'https://img.minirueshop.com/products/clip-poster.webp',
      kind: 'video' as const,
      status: 'processing' as const,
      posterUrl: 'https://img.minirueshop.com/products/clip-poster.webp',
    };

    const { container } = render(<ProductGallery product={PRODUCT_FIXTURE} items={[processing]} />);
    expect(container.querySelector('video')).toBeNull();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });
});
