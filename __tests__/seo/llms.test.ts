import { buildLlmsTxt, llmsProductLine, plainDescription } from '@/lib/seo/llms';
import { SITE_URL } from '@/lib/seo/config';
import type { ApiProduct, Category } from '@/lib/api/catalog';
import { PRODUCT_FIXTURE } from '../storefront/fixtures/product';

/**
 * #150 — /llms.txt and /llms-full.txt let AI assistants read the live catalog.
 * The builders are pure, so the format is checked against fixtures.
 */
const variant = PRODUCT_FIXTURE.variants[0];

const SHAMPOO: ApiProduct = {
  ...PRODUCT_FIXTURE,
  slug: 'karseell-collagen-hair-shampoo',
  name: 'Karseell Collagen Hair Shampoo',
  brandName: 'Karseell',
  brand: 'Karseell',
  categoryName: 'Haircare',
  categorySlug: 'haircare',
  description: '<p>Daily repair <strong>shampoo</strong>.</p>\n<p>Smoother &amp; softer.</p>',
  variants: [{ ...variant, id: 'v1', isActive: true, inStock: true, priceAmount: '850.0000', priceCurrency: 'EGP' }],
};

const SOLD_OUT: ApiProduct = {
  ...SHAMPOO,
  slug: 'sold-out-thing',
  name: 'Sold Out Thing',
  brandName: null,
  brand: null,
  variants: [
    { ...variant, id: 'a', isActive: true, inStock: false, priceAmount: '1200.0000', priceCurrency: 'EGP' },
    { ...variant, id: 'b', isActive: true, inStock: false, priceAmount: '900.0000', priceCurrency: 'EGP' },
  ],
};

const CATEGORIES: Category[] = [
  { id: 'c1', slug: 'haircare', name: 'Haircare', parentId: null },
];

describe('llmsProductLine', () => {
  it('carries name, brand, EGP price, availability and the canonical URL', () => {
    const line = llmsProductLine(SHAMPOO);
    expect(line).toBe(
      `- [Karseell Collagen Hair Shampoo](${SITE_URL}/shop/haircare/karseell-collagen-hair-shampoo): Karseell · EGP 850 · In stock`,
    );
  });

  it('says "from" the lowest price when sizes differ, and marks sold out', () => {
    const line = llmsProductLine(SOLD_OUT);
    expect(line).toContain('from EGP 900');
    expect(line).toContain('Out of stock');
    expect(line).not.toContain('null');
  });

  it('appends the plain-text description when asked', () => {
    const line = llmsProductLine(SHAMPOO, { withDescription: true });
    expect(line).toContain('\n  Daily repair shampoo. Smoother & softer.');
    expect(line).not.toMatch(/<|&amp;/);
  });

  it('marks a product with no active variant as unavailable', () => {
    const line = llmsProductLine({ ...SHAMPOO, variants: [] });
    expect(line).toContain('Price unavailable · Unavailable');
  });
});

describe('plainDescription', () => {
  it('strips tags and decodes entities', () => {
    expect(plainDescription('<p>A &quot;b&quot; &#39;c&#39;</p><br/>d')).toBe('A "b" \'c\' d');
  });
});

describe('buildLlmsTxt', () => {
  const txt = buildLlmsTxt({ products: [SHAMPOO, SOLD_OUT], categories: CATEGORIES });

  it('follows the llmstxt.org shape: H1, blockquote summary, H2 sections', () => {
    const lines = txt.split('\n');
    expect(lines[0]).toBe('# MiniRue');
    expect(txt).toMatch(/^> .+/m);
    expect(txt).toContain('## Products');
    expect(txt).toContain('## Shop');
  });

  it('names every brand spelling and the delivery terms', () => {
    for (const s of ['MiniRue', 'Mini Rue', 'minirueshop']) expect(txt).toContain(s);
    expect(txt).toMatch(/Egypt only/);
    expect(txt).toContain('EGP');
    expect(txt).toMatch(/cash on delivery/i);
    expect(txt).toContain('InstaPay');
  });

  it('links the shop, every category and one line per product', () => {
    expect(txt).toContain(`${SITE_URL}/shop/all`);
    expect(txt).toContain(`[Haircare](${SITE_URL}/shop/haircare)`);
    expect(txt.match(/^- \[.+\]\(.+\/shop\/haircare\/[^)]+\):/gm)).toHaveLength(2);
    expect(txt).toContain(`${SITE_URL}/llms-full.txt`);
  });

  it('omits descriptions unless full', () => {
    expect(txt).not.toContain('Daily repair');
    const full = buildLlmsTxt({ products: [SHAMPOO], categories: CATEGORIES, full: true });
    expect(full).toContain('Daily repair shampoo.');
  });

  it('still produces a valid file when the catalog is empty', () => {
    const empty = buildLlmsTxt({ products: [], categories: [] });
    expect(empty.startsWith('# MiniRue')).toBe(true);
    expect(empty).toContain('## Products');
  });
});
