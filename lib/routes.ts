/**
 * Every shop URL, built in one place.
 *
 * The shop used to have two front doors — `/categories`, whose page was titled
 * "Shop", and `/products`, a second flat catalogue reachable from a tile on the
 * first. The owner asked for one (2026-08-21): "we already have shop tab which
 * redirects customer to any page, single point of entry to everything lives
 * inside shop", and separately that a URL should match the title of the page it
 * opens.
 *
 *   /shop                       the panel: category tiles, All Products, Bundles
 *   /shop/all                   every product, with filters and sort
 *   /shop/{category}            one category, with filters and sort
 *   /shop/{category}/{product}  a product
 *
 * A product's address nests under its category because `products.category_id`
 * is NOT NULL — every product has exactly one, so the nested path is canonical
 * rather than one of several. That is what makes it safe to share: the same
 * product is never reachable at two URLs, so there is no duplicate for a search
 * engine to pick between and no wrong link to paste.
 *
 * These functions exist so the shape above is stated once. The previous scheme
 * was spelled out as string literals across thirty-odd files, which is why it
 * could drift into two front doors in the first place.
 */

export const SHOP_ROOT = '/shop';
export const SHOP_ALL = '/shop/all';

/**
 * The one URL segment a category may not use, because `/shop/all` is the
 * all-products listing and a static route wins over `[category]` in Next's
 * matcher. A category slugged "all" would therefore be unreachable — silently,
 * which is the worst way for it to fail.
 */
export const RESERVED_CATEGORY_SLUGS = ['all'] as const;

export function isReservedCategorySlug(slug: string): boolean {
  return (RESERVED_CATEGORY_SLUGS as readonly string[]).includes(
    slug.toLowerCase(),
  );
}

export function categoryPath(slug: string): string {
  return `${SHOP_ROOT}/${slug}`;
}

/**
 * Where a product lives.
 *
 * Falls back to the legacy `/products/{slug}` when the category slug is missing
 * — which happens only for a response cached before the field existed. That URL
 * still resolves: it is a permanent redirect that looks the category up and
 * forwards to the real address, so a stale cache costs one extra hop rather
 * than a broken link. Emitting `/shop/undefined/{slug}` instead would be a hard
 * 404, and pointing at `/shop/all` would lose the product entirely.
 */
export function productPath(product: {
  slug: string;
  categorySlug?: string | null;
}): string {
  if (!product.categorySlug) return `${LEGACY_PRODUCT_ROOT}/${product.slug}`;
  return `${SHOP_ROOT}/${product.categorySlug}/${product.slug}`;
}

/** Kept only as the redirect source — never link to it. */
export const LEGACY_PRODUCT_ROOT = '/products';
