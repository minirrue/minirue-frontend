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
  /**
   * Empty, NEVER the SKU.
   *
   * This used to fall back to `v.sku`, so a product whose single variant
   * carries no option values rendered a picker chip reading "000001" — an
   * internal identifier shown to a shopper as though it were a choice (owner,
   * 2026-08-21). The readable composite SKU shipped the same day makes that
   * strictly worse, not better: the chip would now read
   * EILISH-INTENSE-EAU-PERFUMES-BILLIE-EILISH-000001.
   *
   * A variant with nothing to say about itself has no label, and the caller
   * decides what to do with that — VariantPicker hides itself entirely, which
   * is the honest answer when there is no choice to make.
   */
  return legacy.length ? legacy.join(' · ') : '';
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
  /**
   * null = MiniRue's own product; set = a partner's.
   *
   * Only used to decide whether a sitewide markdown may strike this price
   * through. MiniRue never cuts a partner's price, so striking one would
   * advertise a discount that checkout refuses.
   */
  collaboratorId?: string | null;
  /**
   * Whether a sitewide markdown applies to this product — the SERVER's answer.
   *
   * MiniRue owns a product only when neither the product nor its BRAND records
   * a collaborator, which is the rule the backend prices orders with. The
   * storefront used to re-derive it from `collaboratorId` alone: a product with
   * no collaborator of its own, on a brand that has one, was struck through
   * here and charged in full at checkout (#3).
   *
   * Optional because an older API response will not carry it. Callers must
   * treat a missing value as NOT eligible — see `useDiscountedPrice`.
   */
  isMinirueOwned?: boolean;
  fragranceFamily?: string | null;
  gender?: 'men' | 'women' | 'unisex' | null;
  description?: string;
  tagline?: string;
  categoryId?: string;
  categoryName?: string | null;
  /** The category's URL slug. A product lives at /shop/{categorySlug}/{slug},
   *  and `products.category_id` is NOT NULL, so every product has exactly one
   *  — which is what makes that a canonical address rather than one of
   *  several. Optional only because older cached responses predate the field;
   *  `productPath()` falls back rather than emitting a broken link. */
  categorySlug?: string | null;
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

/** A brand as the shop's filter rail needs it — id, name, picture, nothing else. */
export interface ShopBrand {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
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
  /**
   * Opt back into Next's Data Cache for this call. NOT a filter — the sitemap
   * is the only caller, because a statically generated route cannot contain a
   * no-store fetch. See listProducts.
   */
  revalidate?: number;
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
    /**
     * See the note on getProductBySlug below: the backend owns this cache now.
     *
     * `revalidate` is the ONE exception, and it exists for the sitemap. A
     * statically generated route cannot contain a no-store fetch — Next
     * refuses to prerender it — so with no way to opt back in, the build
     * emitted a sitemap with zero product URLs. Silently, at build time,
     * having "fixed" a caching bug. Freshness there is worth nothing anyway:
     * the sitemap is regenerated on deploy.
     */
    return catalogFetch<PaginatedProducts>(`/products${qs ? `?${qs}` : ''}`, {
      ...(filters.revalidate !== undefined
        ? { next: { revalidate: filters.revalidate } }
        : { cache: 'no-store' }),
    });
  },

  /** GET /v1/catalog/products/:id */
  async getProductById(id: string): Promise<ApiProduct> {
    return catalogFetch<ApiProduct>(`/products/${id}`, { cache: 'no-store' });
  },

  /**
   * NO Next Data Cache on the catalogue reads (2026-08-21).
   *
   * These used to carry `next: { revalidate: 60 }`, which put every product
   * page behind a cache nothing in the system can invalidate. An admin added a
   * variant, the backend purged its own caches exactly as designed, and the
   * shop went on serving Next's copy for up to a minute — reported as "it
   * doesn't reflect on the storefront, even on refresh".
   *
   * Two caching layers where only ONE can be purged is strictly worse than one
   * layer that can, because the un-purgeable one sets the floor on how stale
   * the shop can be. So the storefront asks every time and the backend holds
   * the cache: @CachePublic(CacheNs.CATALOG, 60) on the same endpoints, which
   * invalidateProductCache already drops on every product and variant write.
   *
   * Same wall-clock cost — one HTTP call to a warm cache instead of a local
   * cache read — and the shop is correct the instant a save lands.
   */
  /** GET /v1/catalog/products/slug/:slug */
  async getProductBySlug(slug: string): Promise<ApiProduct> {
    return catalogFetch<ApiProduct>(`/products/slug/${slug}`, {
      cache: 'no-store',
    });
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

  /**
   * GET /v1/catalog/brands — the house brands the shop can be filtered by.
   *
   * Backend 0.89.0. Partners are NOT in here; they have their own list at
   * /collab/brands and their own pages. Cached 120s server-side and asked for
   * fresh here, same as every other catalogue read — see getProductBySlug.
   */
  /** `categoryId` narrows to brands with a published product in that category. */
  async listBrands(categoryId?: string): Promise<ShopBrand[]> {
    const qs = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : '';
    const res = await catalogFetch<{ data: ShopBrand[] }>(`/brands${qs}`, {
      cache: 'no-store',
    });
    return res.data;
  },

  /** GET /v1/catalog/categories */
  async listCategories(opts?: { revalidate?: number }): Promise<Category[]> {
    // 60s, matching products — NOT the 300s this used to be. The category list
    // carries each category's PICTURE, and the shop renders categories as
    // image tiles. Five minutes of Data Cache (on top of React Query's own
    // staleTime, see lib/hooks/queries.ts) meant an admin who replaced a
    // category photo watched the shop keep serving the url of the previous
    // one long after the swap — and, until the backend started retaining
    // replaced objects, serving a BROKEN tile for that window, because the
    // object behind the old url was already gone (owner, 2026-07-31).
    // Pinned by __tests__/storefront/replaced-image-freshness.test.ts.
    // See listProducts: `revalidate` is here so the statically generated
    // sitemap can opt back into caching. Everything else asks fresh.
    const res = await catalogFetch<{ data: Category[] }>('/categories', {
      next: { revalidate: opts?.revalidate ?? 60 },
    });
    return res.data;
  },
};
