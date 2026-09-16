import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductGallery from '@/components/storefront/ProductGallery';
import { carouselMedia, mediaImageUrl, type MediaAsset } from '@/lib/api/catalog';
import { PRODUCT_FIXTURE } from './fixtures/product';
import { installMockIO } from './fixtures/intersection-observer';

/**
 * Before this, a phone got a scroll-snap strip with nothing on screen to say a
 * second photograph existed, and a laptop got a stack of full-height slabs.
 */
describe('ProductGallery', () => {
  const items = carouselMedia(PRODUCT_FIXTURE);

  it('renders one slide and one dot per photograph', () => {
    render(<ProductGallery product={PRODUCT_FIXTURE} items={items} />);

    expect(items).toHaveLength(3);
    expect(screen.getAllByRole('img')).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: /go to photo/i })).toHaveLength(3);
  });

  it('starts on the cover and says which photograph you are on', () => {
    render(<ProductGallery product={PRODUCT_FIXTURE} items={items} />);

    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go to photo 1 of 3/i })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('moves to the photograph whose dot was pressed', async () => {
    render(<ProductGallery product={PRODUCT_FIXTURE} items={items} />);

    await userEvent.click(screen.getByRole('button', { name: /go to photo 3 of 3/i }));

    expect(screen.getByText('3 / 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go to photo 3 of 3/i })).toHaveAttribute(
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
  });

  it('shows no dots, counter or arrows for a product with one photograph', () => {
    render(<ProductGallery product={PRODUCT_FIXTURE} items={[items[0]]} />);

    expect(screen.queryByRole('button', { name: /go to photo/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /next slide/i })).toBeNull();
    expect(screen.queryByText(/1 \/ 1/)).toBeNull();
  });

  /**
   * #135 — a product video plays in the storefront player.
   *
   * The API has sent `kind`, `posterUrl` and `status` on gallery media since
   * dashboard#51, but the storefront read `url` only, so a ready product video
   * — whose `url` IS the movie — was handed to an image tag.
   */
  describe('video items (#135)', () => {
    const clip: MediaAsset = {
      ...items[1],
      id: 'm-clip',
      url: 'https://s3.test/clip.mp4?signed',
      kind: 'video',
      status: 'ready',
      posterUrl: 'https://img.test/clip-poster.webp',
    };
    let restoreIO: () => void;
    beforeEach(() => {
      restoreIO = installMockIO();
      jest.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
      jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    });
    afterEach(() => {
      restoreIO();
      jest.restoreAllMocks();
    });

    it('renders a ready video as a player with its poster and ring, never as an image', () => {
      const { container } = render(
        <ProductGallery product={PRODUCT_FIXTURE} items={[items[0], clip, items[2]]} />,
      );

      const video = container.querySelector('video');
      expect(video).toHaveAttribute('poster', 'https://img.test/clip-poster.webp');
      expect(video).not.toHaveAttribute('controls');
      expect(screen.getByRole('button', { name: 'Play video' })).toBeInTheDocument();
      expect(container.querySelector('img[src*="clip.mp4"]')).toBeNull();
      expect(screen.getAllByRole('img')).toHaveLength(2);
    });

    it('shows a video that is still converting as its still', () => {
      const converting: MediaAsset = { ...clip, status: 'processing', url: 'https://img.test/clip-poster.webp' };
      const { container } = render(
        <ProductGallery product={PRODUCT_FIXTURE} items={[items[0], converting]} />,
      );

      expect(container.querySelector('video')).toBeNull();
      expect(screen.getAllByRole('img')).toHaveLength(2);
    });

    it('gives every image surface the poster, not the movie', () => {
      expect(mediaImageUrl(clip)).toBe('https://img.test/clip-poster.webp');
      // Still converting: `url` is already the still.
      expect(mediaImageUrl({ ...clip, status: 'processing', url: 'https://img.test/still.webp', posterUrl: null })).toBe(
        'https://img.test/still.webp',
      );
      // Ready with no poster: nothing an image tag can show.
      expect(mediaImageUrl({ ...clip, posterUrl: null })).toBeNull();
      // A photo is untouched.
      expect(mediaImageUrl({ ...items[1], url: 'https://img.test/p.webp' })).toBe('https://img.test/p.webp');
    });
  });
});
