import { cache } from 'react';
import { catalog, productBrand } from '@/lib/api/catalog';
import type { ApiProduct } from '@/lib/api/catalog';
import { fetchStorefrontChrome, FALLBACK_CHROME } from '@/lib/api/storefront';

export interface BrandListingOutcome {
  /** false when the API failed. Distinct from "succeeded and found nothing" —
   *  an outage must never be published as "MiniRue doesn't carry this brand". */
  ok: boolean;
  products: ApiProduct[];
  total: number;
  hasMore: boolean;
  cursor: string | null;
}

const EMPTY: BrandListingOutcome = { ok: true, products: [], total: 0, hasMore: false, cursor: null };

/**
 * One products fetch per request, shared by generateMetadata and the page
 * body, via React's cache() — same reasoning as `app/search/search-data.ts`.
 * Keyed on the two raw filter strings so `/products?brandId=X` and
 * `/products?brand=Y` (and the unfiltered `('', '')` call) each dedupe to
 * their own cache slot within a request instead of colliding.
 */
export const getProductListing = cache(
  async (
    brand: string,
    brandId: string,
    categoryId: string = '',
  ): Promise<BrandListingOutcome> => {
    try {
      const res = await catalog.listProducts({
        ...(brand ? { brand } : {}),
        ...(brandId ? { brandId } : {}),
        ...(categoryId ? { categoryId } : {}),
        limit: 24,
      });
      return {
        ok: true,
        products: res.data,
        total: res.meta.total,
        hasMore: res.meta.hasMore,
        cursor: res.meta.cursor,
      };
    } catch {
      return { ...EMPTY, ok: false };
    }
  },
);

/**
 * A brand-filtered `/products` listing may be indexed only when the filter
 * actually resolved to real results. Three separate ways to fail this, all of
 * which the old static metadata previously published as indexable: an unknown
 * brandId, a `brand` name with no matches, and an API outage. The last is the
 * dangerous one — during a backend blip this would otherwise render an empty
 * grid and invite Google to index that as "MiniRue has nothing here".
 */
export function isIndexableBrandListing(hasFilter: boolean, outcome: BrandListingOutcome): boolean {
  return hasFilter && outcome.ok && outcome.total > 0;
}

/**
 * The display brand name for copy — read only from a real fetched product,
 * never from the raw query string. `brandId` is an opaque id with nothing to
 * display, and a `brand` name param's casing/spelling is not guaranteed to
 * match the real brand, so the only trustworthy source is what the API
 * actually resolved. Returns null whenever there is nothing to safely say —
 * covers the zero-result, unknown-brand and outage cases in one place.
 */
export function brandListingName(outcome: BrandListingOutcome): string | null {
  return outcome.products.length ? productBrand(outcome.products[0]) : null;
}

/**
 * The display category name for a `?categoryId=` filtered listing — same
 * rule as `brandListingName`: read only from a real resolved product, never
 * from the raw id, so an unknown categoryId, zero matches, or an outage all
 * fall back to null (handled the same way `brandName` is upstream) rather
 * than showing something unverified.
 */
export function categoryListingName(outcome: BrandListingOutcome): string | null {
  return outcome.products.length ? (outcome.products[0].categoryName ?? null) : null;
}

/**
 * The one admin-editable shop name (see `ResolvedChrome.shopName`), cached
 * per-request the same way `getProductListing` is — `generateMetadata` and
 * the page body both need it, and without `cache()` that would be two
 * fetches to `/storefront/chrome` for one request. Never throws: a chrome
 * fetch failure must not take metadata generation or the page down with it,
 * so this falls back to the same default the backend itself falls back to.
 */
export const getShopName = cache(async (): Promise<string> => {
  try {
    const chrome = await fetchStorefrontChrome();
    return chrome.shopName || FALLBACK_CHROME.shopName;
  } catch {
    return FALLBACK_CHROME.shopName;
  }
});
