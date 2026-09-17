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
   * #58 — the slide is a FIXED ratio at every width.
   *
   * It used to be `lg:aspect-auto lg:h-screen`: no ratio on a laptop, just "as
   * tall as the window", so the crop changed with the window and a tall one
   * enlarged a ~900px source past 1:1. 1:1 from `lg:` is what the dashboard
   * crops to, so a square box shows the admin's crop whole.
   */
  describe('the slide box (#58)', () => {
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

    it('is a square, viewport-independent box from lg: — never window-tall', () => {
      render(<ProductGallery product={PRODUCT_FIXTURE} items={items} />);

      const boxes = slideBoxes();
      expect(boxes).toHaveLength(items.length);
      for (const box of boxes) {
        expect(box.className).toContain('lg:aspect-square');
        // The two halves of the old rule. `h-screen` is what made the crop a
        // function of window height and what upscaled the source on a tall
        // display; `aspect-auto` is what dropped the ratio to let it.
        expect(box.className).not.toContain('lg:h-screen');
        expect(box.className).not.toContain('lg:aspect-auto');
      }
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

    it('preserves the mobile crop, contains desktop portraits, and keeps the source WebP', () => {
      render(<ProductGallery product={PRODUCT_FIXTURE} items={items} />);

      for (const img of screen.getAllByRole('img')) {
        expect(img.className).toContain('object-cover');
        expect(img.className).toContain('lg:object-contain');
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
