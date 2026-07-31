import { cache } from 'react';
import { catalog, productBrand } from '@/lib/api/catalog';
import type { ApiProduct } from '@/lib/api/catalog';

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
  async (brand: string, brandId: string): Promise<BrandListingOutcome> => {
    try {
      const res = await catalog.listProducts({
        ...(brand ? { brand } : {}),
        ...(brandId ? { brandId } : {}),
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
