/**
 * Catalog API client
 * All endpoints relative to NEXT_PUBLIC_API_URL (default: http://localhost:8002)
 * Uses plain fetch (not apiFetch) — catalog is public, no auth required.
 */

import { cacheLife, cacheTag } from 'next/cache';

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8002') + '/v1/catalog';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ProductVariant {
  id: string;
  sku: string;
  sizeMl: number;
  bottleType: string;
  priceAmount: string; // Always string (Dinero.js) — never parse as float
  priceCurrency: string;
  isActive: boolean;
}

export interface MediaAsset {
  id: string;
  cloudinaryPublicId: string;
  width: number;
  height: number;
  altText: string;
  sortOrder: number;
}

export interface ApiProduct {
  id: string;
  slug: string;
  name: string;
  brand: string;
  fragranceFamily: string;
  gender: 'men' | 'women' | 'unisex';
  description?: string;
  tagline?: string;
  categoryId?: string;
  categoryName?: string;
  variants: ProductVariant[];
  media: MediaAsset[];
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  children?: Category[];
}

export interface ProductListFilters {
  gender?: 'men' | 'women' | 'unisex';
  brand?: string;
  categoryId?: string;
  priceMin?: number;
  priceMax?: number;
  cursor?: string;
  limit?: number;
}

export interface PaginatedProducts {
  data: ApiProduct[];
  meta: {
    cursor: string | null;
    total: number;
    hasMore: boolean;
  };
}

// ── Cloudinary URL helper ────────────────────────────────────────────────────

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? 'minirue';

export function cloudinaryUrl(
  publicId: string,
  opts: { w?: number; h?: number; q?: number } = {},
): string {
  const transforms = [
    'f_auto',
    opts.q != null ? `q_${opts.q}` : 'q_auto',
    opts.w != null ? `w_${opts.w}` : null,
    opts.h != null ? `h_${opts.h}` : null,
  ]
    .filter(Boolean)
    .join(',');
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transforms}/${publicId}`;
}

/** Returns the primary media asset for a product (lowest sortOrder). */
export function primaryMedia(product: ApiProduct): MediaAsset | null {
  if (!product.media?.length) return null;
  return [...product.media].sort((a, b) => a.sortOrder - b.sortOrder)[0];
}

/** Returns the lowest priceAmount across active variants (string, not parsed). */
export function lowestPrice(product: ApiProduct): { amount: string; currency: string } | null {
  const active = product.variants?.filter((v) => v.isActive) ?? [];
  if (!active.length) return null;
  // Sort numerically by parsing for comparison only — never store as float
  const sorted = [...active].sort(
    (a, b) => parseFloat(a.priceAmount) - parseFloat(b.priceAmount),
  );
  return { amount: sorted[0].priceAmount, currency: sorted[0].priceCurrency };
}

// ── Fetch helpers ────────────────────────────────────────────────────────────

async function catalogFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let body: Record<string, unknown> = {};
    try {
      body = (await res.json()) as Record<string, unknown>;
    } catch {
      // ignore parse failure
    }
    const err = new Error((body['message'] as string) ?? res.statusText);
    (err as Error & { status: number }).status = res.status;
    throw err;
  }

  return res.json() as Promise<T>;
}

// ── Public API ───────────────────────────────────────────────────────────────

export const catalog = {
  /** GET /v1/catalog/products — list with optional filters */
  async listProducts(filters: ProductListFilters = {}): Promise<PaginatedProducts> {
    'use cache';
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });
    cacheTag('products');

    const params = new URLSearchParams();
    if (filters.gender) params.set('gender', filters.gender);
    if (filters.brand) params.set('brand', filters.brand);
    if (filters.categoryId) params.set('categoryId', filters.categoryId);
    if (filters.priceMin != null) params.set('priceMin', String(filters.priceMin));
    if (filters.priceMax != null) params.set('priceMax', String(filters.priceMax));
    if (filters.cursor) params.set('cursor', filters.cursor);
    if (filters.limit != null) params.set('limit', String(filters.limit));
    const qs = params.toString();
    return catalogFetch<PaginatedProducts>(`/products${qs ? `?${qs}` : ''}`);
  },

  /** GET /v1/catalog/products/:id */
  async getProductById(id: string): Promise<ApiProduct> {
    'use cache';
    cacheLife({ stale: 300, revalidate: 900, expire: 86400 });
    cacheTag('products', `product:${id}`);

    return catalogFetch<ApiProduct>(`/products/${id}`);
  },

  /** GET /v1/catalog/products/slug/:slug */
  async getProductBySlug(slug: string): Promise<ApiProduct> {
    'use cache';
    cacheLife({ stale: 300, revalidate: 900, expire: 86400 });
    cacheTag('products', `product:${slug}`);

    return catalogFetch<ApiProduct>(`/products/slug/${slug}`);
  },

  /** GET /v1/catalog/search?q= */
  async search(q: string, cursor?: string): Promise<PaginatedProducts> {
    // Search is deliberately uncached — results must always be fresh
    const params = new URLSearchParams({ q });
    if (cursor) params.set('cursor', cursor);
    return catalogFetch<PaginatedProducts>(`/search?${params.toString()}`);
  },

  /** GET /v1/catalog/categories */
  async listCategories(): Promise<Category[]> {
    'use cache';
    cacheLife({ stale: 300, revalidate: 900, expire: 86400 });
    cacheTag('categories');

    const res = await catalogFetch<{ data: Category[] }>('/categories');
    return res.data;
  },
};
