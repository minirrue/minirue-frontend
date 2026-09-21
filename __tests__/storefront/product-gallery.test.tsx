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

    it('never forces 4:5 — not even on a phone (owner: only our cropper may crop)', () => {
      // This test previously asserted the OPPOSITE: that the frame keeps a
      // hardcoded `aspect-[4/5]` on a phone. That utility was cropping every
      // photograph that is not exactly 4:5 — measured on production at 390px,
      // frame 0.799 against an image of 0.824, about 3% of the picture shaved
      // off. The owner's rule (2026-09-21) is that a crop may only ever come
      // from the dashboard's own cropper; whatever was uploaded is then shown
      // in full, at every width.
      render(<ProductGallery product={PRODUCT_FIXTURE} items={items} />);

      for (const box of slideBoxes()) {
        expect(box.className).not.toContain('aspect-[4/5]');
        expect(box.className).not.toContain('lg:aspect-auto');
        expect(box.className).toContain('mr-gallery-frame');
      }
    });

    it('carries each photograph\'s own ratio as a NUMBER, derived not defaulted', () => {
      render(<ProductGallery product={PRODUCT_FIXTURE} items={items} />);

      for (const box of slideBoxes()) {
        // 1200x1500. A number, not "1200 / 1500": the media column sizes
        // itself with calc(var(--mr-gallery-ar) * ...) and calc cannot
        // multiply by a ratio.
        expect(box.style.getPropertyValue('--mr-gallery-ar')).toBe('0.8');
      }
    });

    it('derives the ratio from the media row rather than printing the fallback', () => {
      // The fixture happens to be 0.8, which is also the fallback — so on its
      // own the test above cannot tell a derived value from a default. This
      // one uses a ratio that could not have come from the fallback.
      const odd = [{ ...items[0], width: 989, height: 1200 }];
      render(<ProductGallery product={PRODUCT_FIXTURE} items={odd} />);

      expect(slideBoxes()[0].style.getPropertyValue('--mr-gallery-ar')).toBe(
        String(989 / 1200),
      );
    });

    it('falls back to 0.8 when the media row has no dimensions (production does)', () => {
      // `gallery_items.width/height` are nullable, nothing backfills them, and
      // rows with neither are live right now — the case the old comment in
      // ProductGallery called "never seen live". `contain` is what keeps this
      // harmless rather than a crop.
      //
      // The cast is deliberate and is itself part of the bug: `MediaAsset`
      // declares `width`/`height` as required `number`, so TypeScript insists
      // this row cannot exist — while the backend column is nullable and the
      // shop is serving exactly such a row today. The type is a lie about the
      // data, which is a large part of why nobody caught the wrong ratio.
      // Tightening the type to `number | null` belongs with the backfill.
      const dimensionless = [
        { ...items[0], width: null, height: null },
      ] as unknown as typeof items;
      render(<ProductGallery product={PRODUCT_FIXTURE} items={dimensionless} />);

      expect(slideBoxes()[0].style.getPropertyValue('--mr-gallery-ar')).toBe('0.8');
    });

    it('caps the slide to the space under the live header, with no invented gap', () => {
      render(<ProductGallery product={PRODUCT_FIXTURE} items={items} />);

      // Was `calc(100svh - 89px - 24px)`. Both numbers were wrong: 89 ignored
      // the 77px mobile header and the 73px scrolled one, and the 24px was a
      // gap below the frame that simply let the dark description section show
      // through as a black strip at the bottom of the first screen.
      const slide = slideBoxes()[0]?.parentElement as HTMLElement;
      expect(slide.className).toContain('mr-gallery-slide');
      expect(slide.style.getPropertyValue('--mr-gallery-cap-h')).toBe(
        'calc(100svh - var(--mr-header-h, 89px))',
      );
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

    it('uses object-contain at every width, and keeps the source WebP (#185)', () => {
      // Reversed from `object-cover`. The old reasoning was that the frame
      // always takes the photograph's own ratio, so cover and contain render
      // identically — true ONLY when the media row has width/height. When it
      // does not, the frame falls back to a ratio that is not the
      // photograph's and `cover` silently crops to it. `contain` cannot crop
      // under any ratio; the blurred backdrop fills whatever it leaves.
      render(<ProductGallery product={PRODUCT_FIXTURE} items={items} />);

      for (const img of screen.getAllByRole('img')) {
        expect(img.className).toContain('object-contain');
        expect(img.className).not.toContain('object-cover');
        // The PDP source is already a high-quality imgproxy WebP. Sending it
        // through Next again made desktop Chrome choose a 21 KB AVIF re-encode.
        expect(img.getAttribute('src')).not.toContain('/_next/image');
      }
    });

    it('fills what contain leaves with a blurred copy of the same photograph', () => {
      // The owner asked for the backdrop to come from the image itself, so a
      // white-background product shot stops printing a hard white rectangle
      // on the cream page and a letterbox never reads as dead space.
      const { container } = render(
        <ProductGallery product={PRODUCT_FIXTURE} items={items} />,
      );

      const backdrops = Array.from(
        container.querySelectorAll<HTMLElement>('.mr-gallery-backdrop'),
      );
      expect(backdrops).toHaveLength(items.length);

      const imgs = screen.getAllByRole('img');
      backdrops.forEach((backdrop, i) => {
        // Same source as the photograph in front of it, not a separate fetch.
        // jsdom normalises the url() argument with quotes, so compare the
        // extracted URL rather than the whole declaration.
        const url = backdrop.style.backgroundImage.replace(/^url\(["']?|["']?\)$/g, '');
        expect(url).toBe(imgs[i].getAttribute('src'));
        // Decorative only.
        expect(backdrop).toHaveAttribute('aria-hidden', 'true');
      });
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
