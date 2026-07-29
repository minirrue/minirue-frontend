import type { ApiProduct, MediaAsset, ProductVariant } from '@/lib/api/catalog';

/** Mirrors the real /products/no1 payload: one brand, one in-stock size, one
 * sold-out size, a cover plus two carousel images. */

function media(id: string, sortOrder: number, role: MediaAsset['role']): MediaAsset {
  return {
    id,
    cloudinaryPublicId: `minirue/no1-${id}`,
    url: null,
    width: 1200,
    height: 1500,
    altText: `No.1 bottle, view ${sortOrder + 1}`,
    sortOrder,
    role,
    variantId: null,
  };
}

export const IN_STOCK_VARIANT: ProductVariant = {
  id: 'variant-50',
  sku: 'PF-001',
  sizeMl: 50,
  bottleType: null,
  values: [{ attributeId: 'attr-ml', attributeName: 'ML', optionId: 'opt-50', optionName: '50' }],
  priceAmount: '400',
  priceCurrency: 'EGP',
  isActive: true,
  availableQuantity: 6,
  inStock: true,
};

export const SOLD_OUT_VARIANT: ProductVariant = {
  ...IN_STOCK_VARIANT,
  id: 'variant-100',
  sku: 'PF-002',
  sizeMl: 100,
  values: [{ attributeId: 'attr-ml', attributeName: 'ML', optionId: 'opt-100', optionName: '100' }],
  priceAmount: '700',
  availableQuantity: 0,
  inStock: false,
};

export const PRODUCT_FIXTURE: ApiProduct = {
  id: 'product-no1',
  slug: 'no1',
  name: 'No.1',
  brandName: 'Billie Eillish',
  brand: 'Billie Eillish',
  brandId: 'brand-billie',
  fragranceFamily: 'Amber',
  gender: 'women',
  description: 'A warm amber opening.',
  tagline: 'In the darkness, a light.',
  categoryId: 'cat-perfume',
  categoryName: 'Perfumes',
  variants: [IN_STOCK_VARIANT, SOLD_OUT_VARIANT],
  media: [media('m-cover', 0, 'COVER'), media('m-two', 1, 'CAROUSEL'), media('m-three', 2, 'CAROUSEL')],
};

/** Every size sold out — the state the live /products/no1 page is in. */
export const ALL_SOLD_OUT_FIXTURE: ApiProduct = {
  ...PRODUCT_FIXTURE,
  variants: [{ ...IN_STOCK_VARIANT, availableQuantity: 0, inStock: false }],
};
