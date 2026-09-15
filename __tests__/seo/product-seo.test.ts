import {
  buildProductMetadata,
  productSeoDescription,
  productSeoTitle,
  productSitemapEntry,
  PRODUCT_DESCRIPTION_MAX,
} from '@/lib/seo/product-seo';
import { buildProductSchema } from '@/components/seo/ProductSchema';
import { buildBreadcrumbSchema, SHOP_CRUMB } from '@/components/seo/BreadcrumbSchema';
import { organizationSchema, websiteSchema } from '@/components/seo/OrganizationSchema';
import { SITE_URL } from '@/lib/seo/config';
import type { ApiProduct } from '@/lib/api/catalog';
import { PRODUCT_FIXTURE } from '../storefront/fixtures/product';

/**
 * #148 — "minirue shop <product>", "mini rue shop <product>" and
 * "minirueshop <product>" must be able to find a product page. These builders
 * are pure, so every rule is checked against fixtures, not a live API.
 */
const SHAMPOO: ApiProduct = {
  ...PRODUCT_FIXTURE,
  slug: 'karseell-collagen-hair-shampoo',
  name: 'Karseell Collagen Hair Shampoo',
  brandName: 'Karseell',
  brand: 'Karseell',
  categoryName: 'Haircare',
  categorySlug: 'haircare',
  description:
    'daily repair shampoo that gently cleanses while nourishing and restoring damaged hair for a smoother, softer, healthier-looking finish.',
  updatedAt: '2026-09-12T15:27:16.086Z',
};

const SPELLINGS = ['MiniRue', 'Mini Rue', 'minirueshop'];

describe('productSeoTitle', () => {
  it('carries the product, its brand and all three brand spellings', () => {
    const title = productSeoTitle(PRODUCT_FIXTURE);
    expect(title).toBe('No.1 — Billie Eillish | MiniRue (Mini Rue) · minirueshop');
    for (const s of SPELLINGS) expect(title).toContain(s);
  });

  it('does not repeat a brand the product name already starts with', () => {
    expect(productSeoTitle({ ...SHAMPOO, name: 'Karseell Hair Mask' })).toBe(
      'Karseell Hair Mask | MiniRue (Mini Rue) · minirueshop',
    );
  });

  it('works for a product with no brand', () => {
    expect(productSeoTitle({ ...PRODUCT_FIXTURE, brandName: null, brand: null })).toBe(
      'No.1 | MiniRue (Mini Rue) · minirueshop',
    );
  });

  // #155: titles over 60 characters are truncated in results. The handle goes
  // first, then "(Mini Rue)", then the product brand; the name always leads
  // and a brand spelling always closes.
  it('drops "· minirueshop" first when the full title is over 60 characters', () => {
    expect(productSeoTitle(SHAMPOO)).toBe('Karseell Collagen Hair Shampoo | MiniRue (Mini Rue)');
  });

  it('keeps the product brand before the longer brand phrase', () => {
    expect(
      productSeoTitle({ ...SHAMPOO, name: 'Eilish Intense Eau de Parfum', brandName: 'Billie Eillish', brand: 'Billie Eillish' }),
    ).toBe('Eilish Intense Eau de Parfum — Billie Eillish | MiniRue');
  });

  it('drops the product brand only when name and brand cannot fit together', () => {
    expect(
      productSeoTitle({ ...SHAMPOO, name: 'Deep-Restoring Hair Conditioner for Damaged Hair', brandName: 'Karseell', brand: 'Karseell' }),
    ).toBe('Deep-Restoring Hair Conditioner for Damaged Hair | MiniRue');
  });

  it('still leads with the full name and closes with MiniRue when the name alone is too long', () => {
    const name = 'Karseell Maca Essence Oil Moroccan Argan Oil for Hair Healing';
    expect(productSeoTitle({ ...SHAMPOO, name })).toBe(`${name} | MiniRue`);
  });

  it('never exceeds 60 characters when the name leaves room for "| MiniRue"', () => {
    for (let n = 1; n <= 50; n++) {
      const name = 'x'.repeat(n);
      const t = productSeoTitle({ ...PRODUCT_FIXTURE, name });
      expect(t.length).toBeLessThanOrEqual(60);
      expect(t.startsWith(name)).toBe(true);
      expect(t).toMatch(/MiniRue/);
    }
  });

  it('title plus description always carry all three spellings', () => {
    for (const p of [
      PRODUCT_FIXTURE,
      SHAMPOO,
      { ...SHAMPOO, name: 'Karseell Maca Essence Oil Moroccan Argan Oil for Hair Healing' },
    ]) {
      const both = `${productSeoTitle(p)} ${productSeoDescription(p)}`;
      for (const s of SPELLINGS) expect(both).toContain(s);
    }
  });
});

describe('productSeoDescription', () => {
  it('leads with product, brand and "at MiniRue", carries every spelling, within the limit', () => {
    const d = productSeoDescription(PRODUCT_FIXTURE);
    expect(d.startsWith('No.1 by Billie Eillish at MiniRue (Mini Rue).')).toBe(true);
    for (const s of SPELLINGS) expect(d).toContain(s);
    expect(d.length).toBeLessThanOrEqual(PRODUCT_DESCRIPTION_MAX);
  });

  it('fits a long real description into the limit at a word boundary, capitalised', () => {
    const d = productSeoDescription(SHAMPOO);
    expect(d.length).toBeLessThanOrEqual(PRODUCT_DESCRIPTION_MAX);
    expect(d).toMatch(/^Karseell Collagen Hair Shampoo at MiniRue \(Mini Rue\)\. Daily repair shampoo/);
    expect(d).toMatch(/… Shop at minirueshop\.com\.$/);
    expect(d).not.toMatch(/\s…/);
  });

  it('never stuffs a spelling more than once', () => {
    const d = productSeoDescription(SHAMPOO);
    expect(d.match(/minirueshop/gi)).toHaveLength(1);
    expect(d.match(/Mini Rue/g)).toHaveLength(1);
  });

  it('still reads as a sentence with no product description', () => {
    expect(productSeoDescription({ ...PRODUCT_FIXTURE, description: undefined })).toBe(
      'No.1 by Billie Eillish at MiniRue (Mini Rue). Shop at minirueshop.com.',
    );
  });

  it('strips markup and collapses whitespace from the product description', () => {
    const d = productSeoDescription({ ...PRODUCT_FIXTURE, description: '<p>A  warm\n amber</p>' });
    expect(d).toContain('A warm amber.');
  });
});

describe('buildProductMetadata', () => {
  const meta = buildProductMetadata(SHAMPOO);

  it('uses an absolute title so the layout template does not append a second brand suffix', () => {
    expect(meta.title).toEqual({ absolute: productSeoTitle(SHAMPOO) });
    expect(meta.description).toBe(productSeoDescription(SHAMPOO));
  });

  it('is canonical to the product path', () => {
    expect(meta.alternates?.canonical).toBe('/shop/haircare/karseell-collagen-hair-shampoo');
  });

  it('uses the product image for OpenGraph and Twitter', () => {
    const og = meta.openGraph as { images: Array<{ url: string; alt: string }>; url: string };
    expect(og.images[0].url).toContain('minirue/no1-m-cover');
    expect(og.images[0].alt).toBe('Karseell Collagen Hair Shampoo');
    expect(og.url).toBe(`${SITE_URL}/shop/haircare/karseell-collagen-hair-shampoo`);
    expect((meta.twitter as { images: string[] }).images[0]).toBe(og.images[0].url);
  });

  it('omits OpenGraph images for a product with no media', () => {
    const og = buildProductMetadata({ ...SHAMPOO, media: [] }).openGraph as { images?: unknown };
    expect(og.images).toBeUndefined();
  });
});

describe('productSitemapEntry', () => {
  it('lists the canonical product URL with lastmod from updatedAt', () => {
    const e = productSitemapEntry(SHAMPOO);
    expect(e.url).toBe(`${SITE_URL}/shop/haircare/karseell-collagen-hair-shampoo`);
    expect(e.lastModified).toEqual(new Date('2026-09-12T15:27:16.086Z'));
  });

  it('falls back to now when updatedAt is missing or invalid', () => {
    const before = Date.now();
    for (const updatedAt of [undefined, 'not a date']) {
      const lm = productSitemapEntry({ ...SHAMPOO, updatedAt }).lastModified as Date;
      expect(lm.getTime()).toBeGreaterThanOrEqual(before);
    }
  });
});

describe('Product JSON-LD completeness (#148)', () => {
  const schema = buildProductSchema(SHAMPOO) as Record<string, unknown> & {
    image: string[];
    offers: Record<string, unknown>;
  };

  it('has name, image[], description, sku and brand', () => {
    expect(schema.name).toBe(SHAMPOO.name);
    expect(Array.isArray(schema.image)).toBe(true);
    expect(schema.image).toHaveLength(3);
    expect(schema.description).toBe(SHAMPOO.description);
    expect(schema.sku).toBe('PF-001');
    expect(schema.brand).toEqual({ '@type': 'Brand', name: 'Karseell' });
  });

  it('has an offer with price, EGP, availability, url and itemCondition', () => {
    expect(schema.offers).toEqual({
      '@type': 'Offer',
      price: '400',
      priceCurrency: 'EGP',
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      url: `${SITE_URL}/shop/haircare/karseell-collagen-hair-shampoo`,
    });
  });

  it('falls back to the SEO description when the product has none', () => {
    const s = buildProductSchema({ ...SHAMPOO, description: undefined });
    expect(s.description).toBe(productSeoDescription({ ...SHAMPOO, description: undefined }));
  });

  it('omits image when the product has no media', () => {
    expect(buildProductSchema({ ...SHAMPOO, media: [] })).not.toHaveProperty('image');
  });
});

describe('BreadcrumbList for a product page', () => {
  it('is Home / Shop / category / product with absolute item URLs', () => {
    const b = buildBreadcrumbSchema([
      SHOP_CRUMB,
      { name: 'Haircare', path: 'shop/haircare' },
      { name: SHAMPOO.name, path: 'shop/haircare/karseell-collagen-hair-shampoo' },
    ]) as { '@type': string; itemListElement: Array<{ position: number; name: string; item: string }> };
    expect(b['@type']).toBe('BreadcrumbList');
    expect(b.itemListElement.map((i) => [i.position, i.name, i.item])).toEqual([
      [1, 'Home', SITE_URL],
      [2, 'Shop', `${SITE_URL}/shop`],
      [3, 'Haircare', `${SITE_URL}/shop/haircare`],
      [4, SHAMPOO.name, `${SITE_URL}/shop/haircare/karseell-collagen-hair-shampoo`],
    ]);
  });
});

describe('WebSite / Organization alternateName', () => {
  it('carries every brand spelling on both nodes', () => {
    for (const node of [organizationSchema, websiteSchema]) {
      expect(node.name).toBe('MiniRue');
      expect(node.alternateName).toEqual(expect.arrayContaining(SPELLINGS));
    }
  });
});
