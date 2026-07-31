import { cache } from 'react';
import { catalog, productBrand } from '@/lib/api/catalog';
import type { ApiProduct, Category } from '@/lib/api/catalog';
import { findCategoryPath } from './category-breadcrumb';

/**
 * Resolves a slug to its full ancestry via the category tree. Categories are
 * a small, `revalidate: 300` list — Next's automatic per-request fetch
 * memoization already collapses repeat calls with identical args, so this
 * isn't wrapped in React's `cache()` the way the products fetch below is
 * (that one needs it explicitly: see the comment on `getCategoryListing`).
 * Returns null on both "no such slug" and "API unavailable" — the caller
 * cannot and should not tell those apart.
 */
export async function resolveCategoryPath(slug: string): Promise<Category[] | null> {
  try {
    const categories = await catalog.listCategories();
    return findCategoryPath(categories, slug);
  } catch {
    return null;
  }
}

export interface CategoryListingOutcome {
  /** false when the API failed. Distinct from "succeeded and found nothing" —
   *  an outage must never be described as an empty category. */
  ok: boolean;
  products: ApiProduct[];
  total: number;
  hasMore: boolean;
  cursor: string | null;
}

const EMPTY: CategoryListingOutcome = { ok: true, products: [], total: 0, hasMore: false, cursor: null };

/**
 * One products-by-category fetch per request, shared by generateMetadata
 * (which needs the count and representative brand names for richer copy) and
 * the page body (which renders the grid), via React's cache() — same
 * reasoning as `app/search/search-data.ts`. Keyed on categoryId alone; both
 * callers always want the same first page (limit 24).
 */
export const getCategoryListing = cache(
  async (categoryId: string): Promise<CategoryListingOutcome> => {
    try {
      const res = await catalog.listProducts({ categoryId, limit: 24 });
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
 * Up to `max` distinct brand names, in first-seen order, from a fetched
 * product list. There is no `productCount`/brand-list field on `Category` —
 * these are read from the listing the page already fetched, never invented.
 */
export function representativeBrandNames(products: ApiProduct[], max = 3): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const product of products) {
    const name = productBrand(product);
    if (name && !seen.has(name)) {
      seen.add(name);
      names.push(name);
      if (names.length >= max) break;
    }
  }
  return names;
}

/**
 * The category page's meta description. Only ever built from the listing the
 * page already fetched — never from a fabricated count or brand name. An API
 * outage or a genuinely empty category both fall back to the old plain
 * sentence rather than claiming "0 products", which would misdescribe an
 * outage as "this category is empty".
 */
export function buildCategoryDescription(name: string, outcome: CategoryListingOutcome): string {
  if (!outcome.ok || outcome.total === 0) {
    return `Shop ${name} at MiniRue.`;
  }
  const brands = representativeBrandNames(outcome.products);
  const brandPhrase = brands.length ? ` from ${brands.join(', ')}` : '';
  return `${outcome.total} product${outcome.total === 1 ? '' : 's'} in ${name}${brandPhrase} at MiniRue. Original quality perfumes and cosmetics, with free worldwide shipping.`;
}
