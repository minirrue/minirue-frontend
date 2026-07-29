import { cache } from 'react';
import { catalog } from '@/lib/api/catalog';
import type { ApiProduct } from '@/lib/api/catalog';
import { isIndexableSearchTerm, normalizeSearchTerm } from '@/lib/search/query';

export interface SearchOutcome {
  /** false when the API failed. Distinct from "succeeded and found nothing" —
   *  an outage must never be published as "this shop has no such product". */
  ok: boolean;
  products: ApiProduct[];
  total: number;
  hasMore: boolean;
  cursor: string | null;
}

const EMPTY: SearchOutcome = { ok: true, products: [], total: 0, hasMore: false, cursor: null };

/**
 * One search per request, shared by generateMetadata and the page body.
 *
 * generateMetadata has to know how many results there were — that count is what
 * decides indexability — and the page has to render them. React's `cache()`
 * dedupes the two calls within a single request, so asking twice costs one
 * round trip. Without it this would double every search page's API load, since
 * `catalog.search` is deliberately `cache: 'no-store'`.
 */
export const getSearchResults = cache(async (rawQuery: string): Promise<SearchOutcome> => {
  const term = normalizeSearchTerm(rawQuery);
  if (!isIndexableSearchTerm(term)) return EMPTY;

  try {
    const res = await catalog.search(term);
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
});

/**
 * A search page may be indexed only when it actually answers something.
 *
 * Three separate ways to fail this, all of which previously produced an
 * indexable page: a junk term, a real term with no matches, and an API outage.
 * The last is the dangerous one — during a backend blip every search URL would
 * otherwise render "no results" and invite Google to index that as the truth.
 */
export function isIndexableSearchPage(term: string, outcome: SearchOutcome): boolean {
  return isIndexableSearchTerm(normalizeSearchTerm(term)) && outcome.ok && outcome.total > 0;
}
