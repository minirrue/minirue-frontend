/**
 * Catalog API client
 * All endpoints relative to NEXT_PUBLIC_API_URL (default: http://localhost:8002)
 * Uses plain fetch (not apiFetch) — catalog is public, no auth required.
 */

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8002') + '/v1/catalog';

// ── Types ────────────────────────────────────────────────────────────────────

export interface VariantValue {
  attributeId: string;
  attributeName: string;
  optionId: string;
  optionName: string;
}

export interface ProductVariant {
  id: string;
  sku: string;
  /** Legacy fixed columns — null on products created under the attribute
   * system. Render variantLabel() instead of reading these directly. */
  sizeMl?: number | null;
  bottleType?: string | null;
  /** Resolved attribute answers, e.g. [{ attributeName: 'ML', optionName: '50' }]. */
  values?: VariantValue[];
  customValues?: Record<string, string>;
  priceAmount: string; // Always string (Dinero.js) — never parse as float
  priceCurrency: string;
  isActive: boolean;
  /**
   * Sellable units for this variant, from the product endpoint (backend 0.34.0).
   * Optional because an older API response has neither field — absent is treated
   * as IN stock so a stale deployment cannot make the whole catalogue look sold
   * out, and checkout still refuses what is genuinely unavailable.
   */
  availableQuantity?: number;
  inStock?: boolean;
}

/**
 * Whether a variant can be bought. Absent stock fields mean "the API did not say"
 * — treated as available on purpose (see availableQuantity).
 */
export function variantInStock(v: ProductVariant): boolean {
  if (typeof v.inStock === 'boolean') return v.inStock;
  if (typeof v.availableQuantity === 'number') return v.availableQuantity > 0;
  return true;
}

/**
 * Whether the product itself can be bought — true if ANY active variant is
 * in stock. A sold-out 50ml does not make the product unavailable when the
 * 100ml is on the shelf. Shared by ProductSchema and SearchResultsSchema so
 * the two JSON-LD emitters never drift into disagreeing about availability.
 */
export function productInStock(product: { variants?: ProductVariant[] }): boolean {
  return (product.variants ?? []).some((v) => v.isActive && variantInStock(v));
}

/** Human label for a variant: its attribute answers ("50 ML · Amber"), falling
 * back to the legacy size/bottle columns, then to the SKU. Never renders the
 * "nullml" that reading sizeMl directly produces on attribute-based products. */
export function variantLabel(v: ProductVariant): string {
  const fromValues = (v.values ?? []).map(
    (x) => `${x.optionName} ${x.attributeName}`,
  );
  const fromCustom = Object.entries(v.customValues ?? {}).map(
    ([k, val]) => `${val} ${k}`,
  );
  const parts = [...fromValues, ...fromCustom];
  if (parts.length) return parts.join(' · ');
  const legacy = [v.sizeMl ? `${v.sizeMl}ml` : null, v.bottleType].filter(Boolean);
  return legacy.length ? legacy.join(' · ') : v.sku;
}

export interface MediaAsset {
  id: string;
  cloudinaryPublicId: string;
  // Set (and cloudinaryPublicId left empty) when this media row was linked
  // from the Gallery module instead of the legacy Cloudinary flow — already
  // a fully resolved, servable URL (imgproxy-transformed) from the backend,
  // never a raw storage key. Use mediaImageUrl() below, not cloudinaryUrl()
  // directly, so both media sources render correctly.
  url?: string | null;
  width: number;
  height: number;
  altText: string;
  sortOrder: number;
  /** COVER = the single thumbnail shown outside the product (grids, cart, OG
   * image). CAROUSEL = the images inside the product gallery. CLOSING = the
   * photograph the product page ends on. */
  role?: 'COVER' | 'CAROUSEL' | 'CLOSING';
  /** Set when this image belongs to one variant rather than the product. */
  variantId?: string | null;
}

export interface ApiProduct {
  id: string;
  slug: string;
  name: string;
  /** Resolved brand display name. The API sends `brandName`; `brand` is the
   * legacy field name still present in older cached payloads. Read both via
   * productBrand() rather than either one directly. */
  brandName?: string | null;
  brand?: string | null;
  brandId?: string | null;
  fragranceFamily?: string | null;
  gender?: 'men' | 'women' | 'unisex' | null;
  description?: string;
  tagline?: string;
  categoryId?: string;
  categoryName?: string | null;
  variants: ProductVariant[];
  media: MediaAsset[];
  /**
   * Product-level stock aggregate the backend sends (`catalog.service.ts`).
   * Prefer `productInStock()` for availability decisions — it derives the
   * same "any active variant in stock" rule from `variants` directly, so a
   * stale or missing value here can never disagree with what the page
   * actually shows for sale.
   */
  inStock?: boolean;
  /** Average of APPROVED reviews, rounded to one decimal. null when nobody has
   * reviewed it — which is not the same as everyone giving it zero. */
  reviewsAverage?: number | null;
  reviewsCount?: number;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  /**
   * Already a servable URL, resolved server-side (imgproxy, 480px square) —
   * never a raw gallery media id. Categories became mandatory-imaged
   * 2026-07-30, so every category the shop returns has one; null only for a
   * category created before that and never revisited.
   */
  imageUrl?: string | null;
  children?: Category[];
}

export interface ProductListFilters {
  gender?: 'men' | 'women' | 'unisex';
  brand?: string;
  /**
   * Scoped brand filter — matches one exact brand row by id, unlike the
   * legacy `brand` name filter (which the backend now restricts to
   * house/unowned brands only). Use this whenever the id is known, e.g. a
   * house brand tile's `/products?brandId=<id>` link.
   */
  brandId?: string;
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

/**
 * Resolves a MediaAsset to a servable image URL. Gallery-linked media
 * (`url` set, `cloudinaryPublicId` empty) is already a fully resolved URL
 * from the backend — used as-is, no Cloudinary transform applied (imgproxy
 * already handled resize/format server-side). Legacy Cloudinary-linked
 * media still builds a Cloudinary transform URL from its public ID.
 */
export function mediaImageUrl(
  media: MediaAsset,
  opts: { w?: number; h?: number; q?: number } = {},
): string | null {
  if (media.url) return media.url;
  if (media.cloudinaryPublicId) return cloudinaryUrl(media.cloudinaryPublicId, opts);
  return null;
}

/** Brand display name, tolerant of both the current (`brandName`) and legacy
 * (`brand`) API field names. Returns null when the product has no brand. */
export function productBrand(product: {
  brandName?: string | null;
  brand?: string | null;
}): string | null {
  return product.brandName ?? product.brand ?? null;
}

/** Joins the label parts a product byline shows (brand · family), skipping any
 * that are missing so the separator never renders on its own. */
export function productByline(product: {
  brandName?: string | null;
  brand?: string | null;
  fragranceFamily?: string | null;
}): string {
  return [productBrand(product), product.fragranceFamily]
    .filter(Boolean)
    .join(' · ');
}

/**
 * The product's cover thumbnail — the image shown OUTSIDE the product (grids,
 * cart rows, OG image). Prefers the explicitly-flagged COVER row; falls back to
 * the lowest sortOrder for products created before roles existed.
 */
export function primaryMedia(product: ApiProduct): MediaAsset | null {
  if (!product.media?.length) return null;
  const productLevel = product.media.filter((m) => !m.variantId);
  const pool = productLevel.length ? productLevel : product.media;
  const explicit = pool.find((m) => m.role === 'COVER');
  if (explicit) return explicit;
  // Fall back to the lowest sortOrder for products made before roles existed,
  // but never to the closing image — that one has a job at the end of the page,
  // and promoting it would put the same photograph in the grid and the bag.
  const fallbackPool = pool.filter((m) => m.role !== 'CLOSING');
  const usable = fallbackPool.length ? fallbackPool : pool;
  return [...usable].sort((a, b) => a.sortOrder - b.sortOrder)[0];
}

/**
 * The photograph the product page ends on, chosen by an admin. Null when none
 * is set, in which case the page simply ends after the editorial moment.
 */
export function closingMedia(product: ApiProduct): MediaAsset | null {
  return (
    (product.media ?? []).find((m) => !m.variantId && m.role === 'CLOSING') ??
    null
  );
}

/**
 * The images shown INSIDE the product carousel, in order: the cover first, then
 * every other product-level image. Variant-scoped images are excluded — they
 * belong to a variant view, not the product gallery. So is the closing image:
 * it has its own place at the end of the page, and leaving it in here would
 * show the same photograph twice.
 */
export function carouselMedia(product: ApiProduct): MediaAsset[] {
  const cover = primaryMedia(product);
  const rest = (product.media ?? [])
    .filter((m) => !m.variantId && m.role !== 'CLOSING' && m.id !== cover?.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return cover ? [cover, ...rest] : rest;
}

/**
 * The active variant priced lowest — the one `lowestPrice()` quotes and the
 * one whose SKU actually describes that price. Never falls back to an
 * inactive variant, so its price always matches what the storefront lets you
 * buy.
 */
export function cheapestActiveVariant(product: ApiProduct): ProductVariant | null {
  const active = product.variants?.filter((v) => v.isActive) ?? [];
  if (!active.length) return null;
  // Sort numerically by parsing for comparison only — never store as float
  const sorted = [...active].sort(
    (a, b) => parseFloat(a.priceAmount) - parseFloat(b.priceAmount),
  );
  return sorted[0];
}

/** Returns the lowest priceAmount across active variants (string, not parsed). */
export function lowestPrice(product: ApiProduct): { amount: string; currency: string } | null {
  const variant = cheapestActiveVariant(product);
  return variant ? { amount: variant.priceAmount, currency: variant.priceCurrency } : null;
}

// ── Fetch helpers ────────────────────────────────────────────────────────────

async function catalogFetch<T>(
  path: string,
  init?: RequestInit & { next?: { revalidate?: number | false } },
): Promise<T> {
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
    const params = new URLSearchParams();
    if (filters.gender) params.set('gender', filters.gender);
    if (filters.brand) params.set('brand', filters.brand);
    if (filters.brandId) params.set('brandId', filters.brandId);
    if (filters.categoryId) params.set('categoryId', filters.categoryId);
    if (filters.priceMin != null) params.set('priceMin', String(filters.priceMin));
    if (filters.priceMax != null) params.set('priceMax', String(filters.priceMax));
    if (filters.cursor) params.set('cursor', filters.cursor);
    if (filters.limit != null) params.set('limit', String(filters.limit));
    const qs = params.toString();
    // 60s revalidate — real Next.js Data Cache (ISR), not the Cache Components
    // 'use cache' directive: a plain fetch() option is safe to import from
    // both Server and Client Components (browser fetch just ignores the
    // extra `next` key), unlike 'use cache' which Turbopack forbids in any
    // file also reachable from a Client Component (see 2026-07-08 revert).
    return catalogFetch<PaginatedProducts>(`/products${qs ? `?${qs}` : ''}`, {
      next: { revalidate: 60 },
    });
  },

  /** GET /v1/catalog/products/:id */
  async getProductById(id: string): Promise<ApiProduct> {
    return catalogFetch<ApiProduct>(`/products/${id}`, { next: { revalidate: 60 } });
  },

  /** GET /v1/catalog/products/slug/:slug */
  async getProductBySlug(slug: string): Promise<ApiProduct> {
    return catalogFetch<ApiProduct>(`/products/slug/${slug}`, { next: { revalidate: 60 } });
  },

  /** GET /v1/catalog/search?q= */
  async search(q: string, cursor?: string): Promise<PaginatedProducts> {
    // Search is deliberately uncached — results must always be fresh
    const params = new URLSearchParams({ q });
    if (cursor) params.set('cursor', cursor);
    return catalogFetch<PaginatedProducts>(`/search?${params.toString()}`, {
      cache: 'no-store',
    });
  },

  /** GET /v1/catalog/categories */
  async listCategories(): Promise<Category[]> {
    const res = await catalogFetch<{ data: Category[] }>('/categories', {
      next: { revalidate: 300 },
    });
    return res.data;
  },
};
