import { buildCollectionSchema } from '@/components/seo/CollectionSchema';
import type { CollectionBrandItem } from '@/components/seo/CollectionSchema';
import { SITE_URL } from '@/lib/seo/config';
import {
  ALL_SOLD_OUT_FIXTURE,
  IN_STOCK_VARIANT,
  PRODUCT_FIXTURE,
  SOLD_OUT_VARIANT,
} from '../storefront/fixtures/product';

/**
 * buildCollectionSchema is a pure function of (name, path, items) — no
 * fetch, no React — so every branch (product mapping, brand mapping,
 * availability, empty lists) is exercised directly against fixtures rather
 * than a live API, the same approach __tests__/seo/product-schema.test.ts
 * uses for buildProductSchema.
 */
describe('buildCollectionSchema', () => {
  it('builds a CollectionPage node linked back to the WebSite node', () => {
    const schema = buildCollectionSchema('All Products', '/products', {
      kind: 'products',
      products: [PRODUCT_FIXTURE],
    }) as {
      '@type': string;
      url: string;
      name: string;
      isPartOf: { '@id': string };
    };
    expect(schema['@type']).toBe('CollectionPage');
    expect(schema.url).toBe(`${SITE_URL}/products`);
    expect(schema.name).toBe('All Products');
    expect(schema.isPartOf).toEqual({ '@id': `${SITE_URL}/#website` });
  });

  it('builds the path onto SITE_URL for the page url, e.g. a category path', () => {
    const schema = buildCollectionSchema('Rings', '/categories/rings', {
      kind: 'products',
      products: [],
    }) as { url: string };
    expect(schema.url).toBe(`${SITE_URL}/categories/rings`);
  });

  describe('products mode', () => {
    it('maps a product to a ListItem with name, url, image, description and brand', () => {
      const schema = buildCollectionSchema('All Products', '/products', {
        kind: 'products',
        products: [PRODUCT_FIXTURE],
      }) as {
        mainEntity: { itemListElement: Array<{ item: Record<string, unknown> }> };
      };
      const item = schema.mainEntity.itemListElement[0].item;
      expect(item).toMatchObject({
        '@type': 'Product',
        name: PRODUCT_FIXTURE.name,
        url: `${SITE_URL}/products/${PRODUCT_FIXTURE.slug}`,
        description: PRODUCT_FIXTURE.description,
        brand: { '@type': 'Brand', name: PRODUCT_FIXTURE.brandName },
      });
    });

    it('uses the cheapest active variant for both sku and offers.price, never mismatched', () => {
      const schema = buildCollectionSchema('All Products', '/products', {
        kind: 'products',
        products: [PRODUCT_FIXTURE],
      }) as {
        mainEntity: {
          itemListElement: Array<{
            item: { sku?: string; offers?: { price: string; priceCurrency: string } };
          }>;
        };
      };
      const item = schema.mainEntity.itemListElement[0].item;
      // IN_STOCK_VARIANT (400) is cheaper than SOLD_OUT_VARIANT (700) and is
      // still active, so it is the variant both fields must describe.
      expect(item.sku).toBe(IN_STOCK_VARIANT.sku);
      expect(item.offers?.price).toBe(IN_STOCK_VARIANT.priceAmount);
      expect(item.offers?.priceCurrency).toBe(IN_STOCK_VARIANT.priceCurrency);
      expect(item.sku).not.toBe(SOLD_OUT_VARIANT.sku);
    });

    it('marks the item InStock when any active variant is in stock', () => {
      const schema = buildCollectionSchema('All Products', '/products', {
        kind: 'products',
        products: [PRODUCT_FIXTURE],
      }) as { mainEntity: { itemListElement: Array<{ item: { offers?: { availability: string } } }> } };
      expect(schema.mainEntity.itemListElement[0].item.offers?.availability).toBe(
        'https://schema.org/InStock',
      );
    });

    it('marks the item OutOfStock when every variant is sold out', () => {
      const schema = buildCollectionSchema('All Products', '/products', {
        kind: 'products',
        products: [ALL_SOLD_OUT_FIXTURE],
      }) as { mainEntity: { itemListElement: Array<{ item: { offers?: { availability: string } } }> } };
      expect(schema.mainEntity.itemListElement[0].item.offers?.availability).toBe(
        'https://schema.org/OutOfStock',
      );
    });

    it('omits sku and offers when there is no active variant to price', () => {
      const product = { ...PRODUCT_FIXTURE, variants: [] };
      const schema = buildCollectionSchema('All Products', '/products', {
        kind: 'products',
        products: [product],
      }) as { mainEntity: { itemListElement: Array<{ item: Record<string, unknown> }> } };
      const item = schema.mainEntity.itemListElement[0].item;
      expect(item.sku).toBeUndefined();
      expect(item.offers).toBeUndefined();
    });

    it('numbers positions from 1 and reports numberOfItems', () => {
      const schema = buildCollectionSchema('All Products', '/products', {
        kind: 'products',
        products: [PRODUCT_FIXTURE, ALL_SOLD_OUT_FIXTURE],
      }) as {
        mainEntity: {
          numberOfItems: number;
          itemListElement: Array<{ position: number }>;
        };
      };
      expect(schema.mainEntity.numberOfItems).toBe(2);
      expect(schema.mainEntity.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    });
  });

  describe('brands mode', () => {
    const brandItems: CollectionBrandItem[] = [
      {
        name: 'Helia',
        url: `${SITE_URL}/helia`,
        imageUrl: 'https://res.cloudinary.com/minirue/helia-logo.png',
        description: 'A partner atelier.',
      },
      { name: 'No Image Brand', url: `${SITE_URL}/no-image-brand`, imageUrl: null, description: null },
    ];

    it('emits Brand items — never Product — with url pointing at the space page', () => {
      const schema = buildCollectionSchema('Brands', '/brands', {
        kind: 'brands',
        brands: brandItems,
      }) as { mainEntity: { itemListElement: Array<{ item: Record<string, unknown> }> } };
      const [helia, noImage] = schema.mainEntity.itemListElement.map((i) => i.item);
      expect(helia).toEqual({
        '@type': 'Brand',
        name: 'Helia',
        url: `${SITE_URL}/helia`,
        image: 'https://res.cloudinary.com/minirue/helia-logo.png',
        description: 'A partner atelier.',
      });
      // Never a Product type for /brands and /collab — they list spaces.
      expect(helia['@type']).not.toBe('Product');
      // Absent fields are omitted, never emitted as null.
      expect(noImage).toEqual({ '@type': 'Brand', name: 'No Image Brand', url: `${SITE_URL}/no-image-brand` });
      expect(noImage).not.toHaveProperty('image');
      expect(noImage).not.toHaveProperty('description');
    });
  });

  describe('empty lists', () => {
    it('emits a valid, empty ItemList for an empty product list rather than a malformed node', () => {
      const schema = buildCollectionSchema('All Products', '/products', {
        kind: 'products',
        products: [],
      }) as { mainEntity: { numberOfItems: number; itemListElement: unknown[] }; '@type': string };
      expect(schema['@type']).toBe('CollectionPage');
      expect(schema.mainEntity).toEqual({
        '@type': 'ItemList',
        numberOfItems: 0,
        itemListElement: [],
      });
    });

    it('emits a valid, empty ItemList for an empty brand list', () => {
      const schema = buildCollectionSchema('Brands', '/brands', {
        kind: 'brands',
        brands: [],
      }) as { mainEntity: { numberOfItems: number; itemListElement: unknown[] } };
      expect(schema.mainEntity).toEqual({
        '@type': 'ItemList',
        numberOfItems: 0,
        itemListElement: [],
      });
    });
  });
});
