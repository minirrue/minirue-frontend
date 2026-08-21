import { buildBreadcrumbSchema, SHOP_CRUMB } from '@/components/seo/BreadcrumbSchema';
import { SITE_URL } from '@/lib/seo/config';

/**
 * buildBreadcrumbSchema is a pure function of a trail — no fetch, no React —
 * so every branch is exercised directly, the same approach
 * __tests__/seo/collection-schema.test.ts uses for buildCollectionSchema.
 *
 * Task 9 generalised BreadcrumbSchema from a single hardcoded `SECTION`
 * constant to an arbitrary caller-supplied trail so it could express a
 * partner space's `Home / {space} / {child}`, which never passes through
 * "Shop". The "regression" describe block below proves the three pre-existing
 * call sites (`/products`, `/products/[slug]`, `/categories/[slug]`) still
 * emit byte-identical JSON-LD.
 */
describe('buildBreadcrumbSchema', () => {
  it('always prepends Home, built from BASE_URL with no path', () => {
    const schema = buildBreadcrumbSchema([{ name: 'Helia', path: 'helia' }]) as {
      itemListElement: Array<{ name: string; item: string; position: number }>;
    };
    expect(schema.itemListElement[0]).toEqual({
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: SITE_URL,
    });
  });

  it('builds a BreadcrumbList with @context and @type', () => {
    const schema = buildBreadcrumbSchema([{ name: 'Helia', path: 'helia' }]) as {
      '@context': string;
      '@type': string;
    };
    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('BreadcrumbList');
  });

  it('joins a non-empty path onto SITE_URL for a crumb item', () => {
    const schema = buildBreadcrumbSchema([{ name: 'Helia', path: 'helia' }]) as {
      itemListElement: Array<{ item: string }>;
    };
    expect(schema.itemListElement[1].item).toBe(`${SITE_URL}/helia`);
  });

  it('numbers positions from 1 in trail order', () => {
    const schema = buildBreadcrumbSchema([
      { name: 'Helia', path: 'helia' },
      { name: 'Jewellery', path: 'helia/jewellery' },
    ]) as { itemListElement: Array<{ position: number; name: string }> };
    expect(schema.itemListElement.map((i) => [i.position, i.name])).toEqual([
      [1, 'Home'],
      [2, 'Helia'],
      [3, 'Jewellery'],
    ]);
  });

  describe('dedupe filter (preserved from the pre-generalisation component)', () => {
    it('drops a crumb whose path repeats the previous crumb\'s path', () => {
      // e.g. /shop: SHOP_CRUMB and a page's own crumb both resolving to the
      // same path "shop".
      const schema = buildBreadcrumbSchema([
        SHOP_CRUMB,
        { name: 'All Products', path: 'shop' },
      ]) as { itemListElement: Array<{ name: string }> };
      expect(schema.itemListElement.map((i) => i.name)).toEqual(['Home', 'Shop']);
    });

    it('drops a crumb whose name repeats the previous crumb\'s name (case/whitespace-insensitive)', () => {
      const schema = buildBreadcrumbSchema([
        { name: '  Shop  ', path: 'shop' },
        { name: 'shop', path: 'categories/shop' },
      ]) as { itemListElement: Array<{ name: string }> };
      expect(schema.itemListElement.map((i) => i.name)).toEqual(['Home', '  Shop  ']);
    });

    it('keeps two crumbs that differ in both name and path', () => {
      const schema = buildBreadcrumbSchema([
        { name: 'Jewellery', path: 'shop/jewellery' },
        { name: 'Rings', path: 'shop/rings' },
      ]) as { itemListElement: Array<{ name: string }> };
      expect(schema.itemListElement.map((i) => i.name)).toEqual(['Home', 'Jewellery', 'Rings']);
    });
  });

  describe('regression — the three pre-existing call sites (Task 9 generalisation)', () => {
    it('/shop: trail=[SHOP_CRUMB, All Products] collapses to Home / Shop, exactly as the old hardcoded SECTION did', () => {
      const schema = buildBreadcrumbSchema([
        SHOP_CRUMB,
        { name: 'All Products', path: 'shop' },
      ]);
      expect(schema).toEqual({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Shop', item: `${SITE_URL}/shop` },
        ],
      });
    });

    it('/shop/[category]/[product]: trail=[SHOP_CRUMB, product] yields Home / Shop / {product}, item built from products/{slug} — NOT the bare slug', () => {
      const schema = buildBreadcrumbSchema([
        SHOP_CRUMB,
        { name: 'No. 5 Eau de Parfum', path: 'shop/perfumes/no-5-eau-de-parfum' },
      ]);
      expect(schema).toEqual({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Shop', item: `${SITE_URL}/shop` },
          {
            '@type': 'ListItem',
            position: 3,
            name: 'No. 5 Eau de Parfum',
            // The item URL is built from the product's real canonical
            // address, which since 2026-08-21 nests it under its own
            // category: /shop/{category}/{slug}. The old bare-slug URL
            // (${SITE_URL}/no-5-eau-de-parfum) resolves to the live
            // partner-space route (/[slug]) instead — a product breadcrumb
            // built from it could hand Google a partner's shop page as this
            // product's parent.
            item: `${SITE_URL}/shop/perfumes/no-5-eau-de-parfum`,
          },
        ],
      });
    });

    it('/shop/[category]: trail=[SHOP_CRUMB, ...ancestors, category] yields Home / Shop / {ancestors} / {category}', () => {
      const schemaAncestors = [{ name: 'Jewellery', path: 'shop/jewellery' }];
      const schema = buildBreadcrumbSchema([
        SHOP_CRUMB,
        ...schemaAncestors,
        { name: 'Rings', path: 'shop/rings' },
      ]);
      expect(schema).toEqual({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Shop', item: `${SITE_URL}/shop` },
          {
            '@type': 'ListItem',
            position: 3,
            name: 'Jewellery',
            item: `${SITE_URL}/shop/jewellery`,
          },
          {
            '@type': 'ListItem',
            position: 4,
            name: 'Rings',
            item: `${SITE_URL}/shop/rings`,
          },
        ],
      });
    });

    it('/shop/[category] with no ancestors (a top-level category) yields Home / Shop / {category}', () => {
      const schema = buildBreadcrumbSchema([
        SHOP_CRUMB,
        { name: 'Jewellery', path: 'shop/jewellery' },
      ]);
      expect(schema).toEqual({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Shop', item: `${SITE_URL}/shop` },
          {
            '@type': 'ListItem',
            position: 3,
            name: 'Jewellery',
            item: `${SITE_URL}/shop/jewellery`,
          },
        ],
      });
    });
  });

  describe('the new trails this generalisation exists for — the partner space routes', () => {
    it('/[slug] (a space page): Home / {space} — never "Home / Shop / {space}"', () => {
      const schema = buildBreadcrumbSchema([{ name: 'Helia', path: 'helia' }]);
      expect(schema).toEqual({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Helia', item: `${SITE_URL}/helia` },
        ],
      });
    });

    it('/[slug]/[child] (a category inside a space): Home / {space} / {category}', () => {
      const schema = buildBreadcrumbSchema([
        { name: 'Helia', path: 'helia' },
        { name: 'Jewellery', path: 'helia/jewellery' },
      ]);
      expect(schema).toEqual({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Helia', item: `${SITE_URL}/helia` },
          {
            '@type': 'ListItem',
            position: 3,
            name: 'Jewellery',
            item: `${SITE_URL}/helia/jewellery`,
          },
        ],
      });
    });

    it('/[slug]/[child] (a brand inside a space): Home / {space} / {brand}', () => {
      const schema = buildBreadcrumbSchema([
        { name: 'Helia', path: 'helia' },
        { name: 'Chanel', path: 'helia/chanel' },
      ]);
      expect(schema).toEqual({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Helia', item: `${SITE_URL}/helia` },
          {
            '@type': 'ListItem',
            position: 3,
            name: 'Chanel',
            item: `${SITE_URL}/helia/chanel`,
          },
        ],
      });
    });
  });
});
