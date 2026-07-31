import { buildProductSchema } from '@/components/seo/ProductSchema';
import type { PublicReview } from '@/lib/api/reviews';
import {
  ALL_SOLD_OUT_FIXTURE,
  IN_STOCK_VARIANT,
  PRODUCT_FIXTURE,
} from '../storefront/fixtures/product';

function review(overrides: Partial<PublicReview> = {}): PublicReview {
  return {
    id: 'review-1',
    rating: 5,
    title: 'Lovely scent',
    body: 'Lasted all day.',
    verifiedPurchase: true,
    createdAt: '2026-07-01T00:00:00.000Z',
    media: [],
    reviewerName: 'A. Shopper',
    reviewerAvatarUrl: null,
    ...overrides,
  };
}

/**
 * buildProductSchema is a pure function of (product, reviews) — no fetch, no
 * React — so every branch (availability, sku, aggregateRating gate, review
 * mapping) is exercised directly against fixtures rather than a live API.
 */
describe('buildProductSchema', () => {
  it('marks the offer InStock when any active variant is in stock', () => {
    const schema = buildProductSchema(PRODUCT_FIXTURE) as { offers: { availability: string } };
    expect(schema.offers.availability).toBe('https://schema.org/InStock');
  });

  it('marks the offer OutOfStock when every variant is sold out', () => {
    const schema = buildProductSchema(ALL_SOLD_OUT_FIXTURE) as {
      offers: { availability: string };
    };
    expect(schema.offers.availability).toBe('https://schema.org/OutOfStock');
  });

  it('omits offers entirely when there is no active variant to price', () => {
    const product = { ...PRODUCT_FIXTURE, variants: [] };
    const schema = buildProductSchema(product);
    expect(schema.offers).toBeUndefined();
  });

  it('uses the cheapest active variant SKU, never the product id', () => {
    const schema = buildProductSchema(PRODUCT_FIXTURE) as { sku?: string };
    expect(schema.sku).toBe(IN_STOCK_VARIANT.sku);
    expect(schema.sku).not.toBe(PRODUCT_FIXTURE.id);
  });

  it('omits sku when there is no active variant', () => {
    const product = { ...PRODUCT_FIXTURE, variants: [] };
    const schema = buildProductSchema(product) as { sku?: string };
    expect(schema.sku).toBeUndefined();
  });

  it('reads description directly, never the always-undefined tagline', () => {
    // PRODUCT_FIXTURE sets both description and tagline; tagline must never
    // be read for products (it only exists on storefront hero slides).
    const schema = buildProductSchema(PRODUCT_FIXTURE) as { description?: string };
    expect(schema.description).toBe(PRODUCT_FIXTURE.description);
  });

  it('emits aggregateRating when reviewsCount > 0 and reviewsAverage is non-null', () => {
    const product = { ...PRODUCT_FIXTURE, reviewsCount: 12, reviewsAverage: 4.5 };
    const schema = buildProductSchema(product) as {
      aggregateRating?: { ratingValue: number; reviewCount: number };
    };
    expect(schema.aggregateRating).toEqual({
      '@type': 'AggregateRating',
      ratingValue: 4.5,
      reviewCount: 12,
    });
  });

  it('omits aggregateRating when reviewsCount is 0', () => {
    const product = { ...PRODUCT_FIXTURE, reviewsCount: 0, reviewsAverage: null };
    const schema = buildProductSchema(product) as { aggregateRating?: unknown };
    expect(schema.aggregateRating).toBeUndefined();
  });

  it('omits aggregateRating when reviewsAverage is null even if reviewsCount is positive', () => {
    // Should not happen from a well-behaved API, but the gate must not trust
    // reviewsCount alone — never emit a fabricated ratingValue.
    const product = { ...PRODUCT_FIXTURE, reviewsCount: 3, reviewsAverage: null };
    const schema = buildProductSchema(product) as { aggregateRating?: unknown };
    expect(schema.aggregateRating).toBeUndefined();
  });

  it('omits aggregateRating when reviewsCount/reviewsAverage are absent entirely', () => {
    const schema = buildProductSchema(PRODUCT_FIXTURE) as { aggregateRating?: unknown };
    expect(schema.aggregateRating).toBeUndefined();
  });

  it('maps real reviews into schema.org Review entries', () => {
    const schema = buildProductSchema(PRODUCT_FIXTURE, [review()]) as {
      review?: Array<Record<string, unknown>>;
    };
    expect(schema.review).toEqual([
      {
        '@type': 'Review',
        name: 'Lovely scent',
        reviewBody: 'Lasted all day.',
        reviewRating: { '@type': 'Rating', ratingValue: 5 },
        author: { '@type': 'Person', name: 'A. Shopper' },
        datePublished: '2026-07-01T00:00:00.000Z',
      },
    ]);
  });

  it('drops name/reviewBody for a review with no title or body, but keeps it', () => {
    const schema = buildProductSchema(PRODUCT_FIXTURE, [
      review({ title: null, body: null }),
    ]) as { review?: Array<Record<string, unknown>> };
    expect(schema.review).toHaveLength(1);
    expect(schema.review?.[0]).not.toHaveProperty('name');
    expect(schema.review?.[0]).not.toHaveProperty('reviewBody');
  });

  it('omits review entirely when there are none', () => {
    expect(buildProductSchema(PRODUCT_FIXTURE, [])).not.toHaveProperty('review');
    expect(buildProductSchema(PRODUCT_FIXTURE)).not.toHaveProperty('review');
  });

  it('keeps brand from productBrand()', () => {
    const schema = buildProductSchema(PRODUCT_FIXTURE) as {
      brand?: { name: string };
    };
    expect(schema.brand).toEqual({ '@type': 'Brand', name: PRODUCT_FIXTURE.brandName });
  });
});
