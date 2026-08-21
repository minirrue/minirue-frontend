import type { ProductListFilters } from '@/lib/api/catalog';

/**
 * The shop's filters, and the URL they live in.
 *
 * Two rules the owner set (2026-08-21):
 *
 *   "filters are static on frontend, normally they dont have server side
 *    control, its generic"  — the FACETS are fixed in code. Sort options and
 *    price are the same on every shop; no admin configures them, and there is
 *    no screen to.
 *
 *   "however the only server side is brands created and categories created" —
 *    those two facets' OPTIONS come from the catalogue, because they are the
 *    shop's own data and change as the shop does.
 *
 * Applying them is the SERVER's job either way. Filtering a paginated list in
 * the browser would only ever filter the page you happen to have loaded, so
 * "under 300 EGP" would quietly mean "under 300 EGP, among the first 24" — a
 * filter that lies. Every facet here maps onto a query the catalogue API
 * already supports.
 *
 * State lives in the URL so a filtered view is shareable, survives a reload,
 * and the back button steps through it. It is deliberately keyed on search
 * params only, which is why `ScrollRestoration` ignores them — changing a
 * filter must not fling the shopper back to the top of the page they are
 * reading.
 */

export const SORT_OPTIONS = [
  { value: 'relevance', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]['value'];

export const DEFAULT_SORT: SortValue = 'relevance';

export function isSortValue(value: string): value is SortValue {
  return SORT_OPTIONS.some((o) => o.value === value);
}

export interface ShopFilterState {
  sort: SortValue;
  brandId: string | null;
  categoryId: string | null;
  priceMin: number | null;
  priceMax: number | null;
}

export const EMPTY_FILTERS: ShopFilterState = {
  sort: DEFAULT_SORT,
  brandId: null,
  categoryId: null,
  priceMin: null,
  priceMax: null,
};

function readNumber(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  // Rejects NaN, negatives and Infinity in one go. A hand-edited
  // `?priceMin=-5` must not reach the API as a filter nobody can satisfy.
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Reads filter state out of a URLSearchParams-alike. */
export function parseFilters(params: URLSearchParams): ShopFilterState {
  const sort = params.get('sort') ?? '';
  const min = readNumber(params.get('priceMin'));
  const max = readNumber(params.get('priceMax'));

  return {
    sort: isSortValue(sort) ? sort : DEFAULT_SORT,
    brandId: params.get('brandId') || null,
    categoryId: params.get('categoryId') || null,
    priceMin: min,
    // A reversed range is the shopper typing the boxes out of order, not an
    // empty shop. Swapped rather than refused.
    priceMax: max,
    ...(min !== null && max !== null && min > max
      ? { priceMin: max, priceMax: min }
      : {}),
  };
}

/**
 * Back to a query string, omitting anything at its default.
 *
 * Defaults are left OUT rather than written as `?sort=relevance`, so the
 * unfiltered listing keeps a clean URL and one view has exactly one address —
 * which is what lets the page self-canonicalise honestly.
 */
export function toSearchParams(state: ShopFilterState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.sort !== DEFAULT_SORT) params.set('sort', state.sort);
  if (state.brandId) params.set('brandId', state.brandId);
  if (state.categoryId) params.set('categoryId', state.categoryId);
  if (state.priceMin !== null) params.set('priceMin', String(state.priceMin));
  if (state.priceMax !== null) params.set('priceMax', String(state.priceMax));
  return params;
}

/** The shape the catalogue API wants. */
export function toApiFilters(state: ShopFilterState): ProductListFilters {
  return {
    ...(state.brandId ? { brandId: state.brandId } : {}),
    ...(state.categoryId ? { categoryId: state.categoryId } : {}),
    ...(state.priceMin !== null ? { priceMin: state.priceMin } : {}),
    ...(state.priceMax !== null ? { priceMax: state.priceMax } : {}),
    ...(state.sort !== DEFAULT_SORT ? { sortBy: state.sort } : {}),
  };
}

/**
 * How many facets are actually narrowing the list.
 *
 * Sort is excluded on purpose: re-ordering is not filtering, and counting it
 * would put a "1" on the button for a shopper who has hidden nothing.
 */
export function activeFilterCount(state: ShopFilterState): number {
  return [
    state.brandId,
    state.categoryId,
    state.priceMin,
    state.priceMax,
  ].filter((v) => v !== null && v !== '').length;
}
