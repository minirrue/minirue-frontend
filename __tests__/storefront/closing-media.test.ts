import {
  carouselMedia,
  closingMedia,
  primaryMedia,
  type ApiProduct,
  type MediaAsset,
} from '@/lib/api/catalog';
import { PRODUCT_FIXTURE } from './fixtures/product';

function media(id: string, sortOrder: number, role: MediaAsset['role']): MediaAsset {
  return {
    id,
    cloudinaryPublicId: `minirue/${id}`,
    url: null,
    width: 1200,
    height: 1500,
    altText: id,
    sortOrder,
    role,
    variantId: null,
  };
}

function withMedia(assets: MediaAsset[]): ApiProduct {
  return { ...PRODUCT_FIXTURE, media: assets };
}

/**
 * The closing photograph ends the product page. It must not also appear
 * mid-carousel, or the shopper sees the same picture twice on one page, and it
 * must never be promoted to the cover, or the same picture turns up in the
 * grid and the bag as well.
 */
describe('closing image', () => {
  const cover = media('m-cover', 0, 'COVER');
  const middle = media('m-two', 1, 'CAROUSEL');
  const closing = media('m-closing', 2, 'CLOSING');

  it('is found when one is marked', () => {
    expect(closingMedia(withMedia([cover, middle, closing]))?.id).toBe('m-closing');
  });

  it('is null when none is marked', () => {
    expect(closingMedia(withMedia([cover, middle]))).toBeNull();
  });

  it('is kept out of the carousel', () => {
    const ids = carouselMedia(withMedia([cover, middle, closing])).map((m) => m.id);
    expect(ids).toEqual(['m-cover', 'm-two']);
  });

  it('is never promoted to the cover, even when no cover is set', () => {
    // Products made before roles existed fall back to the lowest sortOrder.
    const older = media('m-plain', 5, 'CAROUSEL');
    const chosen = primaryMedia(withMedia([closing, older]));
    expect(chosen?.id).toBe('m-plain');
  });

  it('falls back to the closing image only when it is the sole photograph', () => {
    // A page with one picture should still show it rather than show nothing.
    expect(primaryMedia(withMedia([closing]))?.id).toBe('m-closing');
  });
});
