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
    staleTime: 1000 * 60 * 30, // 30m — categories change infrequently
  });

export const searchProductsQueryOptions = (query: string) =>
  queryOptions({
    queryKey: ['catalog', 'search', query],
    queryFn: () => catalog.search(query),
  });
