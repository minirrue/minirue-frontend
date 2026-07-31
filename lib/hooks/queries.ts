import { queryOptions } from '@tanstack/react-query';
import { catalog } from '@/lib/api/catalog';
import type { ProductListFilters } from '@/lib/api/catalog';

/**
 * Query‑options factories — single source of truth for query keys and fetch
 * functions.  Consumed by both server‑side `prefetchQuery` calls and
 * client‑side `useQuery`/`useSuspenseQuery` hooks.
 */

export const productsQueryOptions = (filters?: ProductListFilters) =>
  queryOptions({
    queryKey: ['catalog', 'products', filters || {}],
    queryFn: () => catalog.listProducts(filters),
  });

export const productBySlugQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: ['catalog', 'product', 'slug', slug],
    queryFn: () => catalog.getProductBySlug(slug),
  });

export const categoriesQueryOptions = () =>
  queryOptions({
    queryKey: ['catalog', 'categories'],
    queryFn: () => catalog.listCategories(),
    // 60s, not the 30m this used to be. "Categories change infrequently" was
    // true of the NAMES and false of the PICTURES: the shop renders categories
    // as image tiles, and half an hour of client cache is half an hour of
    // serving the url of a photo the admin already replaced (owner,
    // 2026-07-31). Pinned by
    // __tests__/storefront/replaced-image-freshness.test.ts, which also checks
    // this stays well inside the window the backend keeps the replaced object
    // alive for (StorageService.REPLACED_OBJECT_RETENTION_MS).
    staleTime: 1000 * 60,
  });

export const searchProductsQueryOptions = (query: string) =>
  queryOptions({
    queryKey: ['catalog', 'search', query],
    queryFn: () => catalog.search(query),
  });
