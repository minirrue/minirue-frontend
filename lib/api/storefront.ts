/**
 * Storefront resolved-content client.
 *
 * Types mirror `apps/minirue-backend/src/storefront/interfaces/resolved-storefront.interface.ts`
 * and `storefront-layout.interface.ts` exactly (including the post-brief fields `imageAlt`,
 * `ariaLabel`, `scrollCueLabel`, `badge`). Plain async fetchers only — no React here — so both
 * the Server Component (SSR prefetch) and the client hooks (`lib/hooks/use-storefront.ts`) can
 * call them.
 */

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8002') + '/v1';

// ── Shared enums ─────────────────────────────────────────────────────────────

export type PaymentBadge = 'visa' | 'mastercard' | 'instapay';
export type SocialNetwork =
  | 'instagram'
  | 'tiktok'
  | 'facebook'
  | 'x'
  | 'youtube'
  | 'whatsapp'
  | 'pinterest';

export type CtaTarget =
  | { kind: 'scroll' }
  | { kind: 'url'; url: string }
  | { kind: 'product'; productId: string }
  | { kind: 'category'; categoryId: string }
  | { kind: 'brand'; brandId: string };

export interface AnnouncementConfig {
  enabled: boolean;
  messages: string[];
  linkUrl: string | null;
  background: string | null;
}

// ── Home ─────────────────────────────────────────────────────────────────────

/** A product already serialized by CatalogService — passed through untouched. */
export type ResolvedProduct = Record<string, unknown>;

export interface ResolvedHeroSlide {
  id: string;
  mode: 'image' | 'editorial';
  eyebrow: string;
  headline: string;
  sub: string;
  tagline: string;
  /** Loadable URL for an image slide; null when unset or the item vanished. */
  imageUrl: string | null;
  /** Portrait crop for mobile; null falls back to imageUrl on every screen. */
  mobileImageUrl: string | null;
  /** Admin-authored alt text for the rendered image. */
  imageAlt: string;
  background: string;
  bottle: string | null;
  cap: string | null;
  ctaLabel: string | null;
  ctaTarget: CtaTarget;
  /** Pre-resolved href for a product/category/brand target. */
  ctaHref: string | null;
}

export interface ResolvedBrandCard {
  id: string;
  name: string;
  href: string;
  logoUrl: string | null;
  productCount: number;
}

export type ResolvedSection =
  | {
      id: string;
      type: 'hero';
      autoplayMs: number;
      ariaLabel: string;
      /** null hides the scroll cue entirely rather than only renaming it. */
      scrollCueLabel: string | null;
      slides: ResolvedHeroSlide[];
    }
  | { id: string; type: 'ribbon'; items: string[]; speedSeconds: number; surface: 'ink' | 'cream' }
  | {
      id: string;
      type: 'productGrid';
      eyebrow: string;
      title: string;
      display: 'products' | 'brands';
      viewAllHref: string | null;
      products: ResolvedProduct[];
      brands: ResolvedBrandCard[];
    }
  | {
      id: string;
      type: 'journal';
      eyebrow: string;
      title: string;
      body: string;
      imageUrl: string | null;
      imageSide: 'left' | 'right';
      /** Small overlay label on the image, e.g. "Editorial · N°4". null hides it. */
      badge: string | null;
      ctaLabel: string | null;
      ctaHref: string | null;
    }
  | {
      id: string;
      type: 'collabShowcase';
      eyebrow: string;
      title: string;
      tabs: Array<{
        collaboratorId: string;
        label: string;
        brandSlug: string;
        logoUrl: string | null;
        description: string | null;
        products: ResolvedProduct[];
      }>;
    };

export interface ResolvedHome {
  sections: ResolvedSection[];
  announcement: AnnouncementConfig;
}

// ── Chrome ───────────────────────────────────────────────────────────────────

export type NavItem =
  | { id: string; kind: 'category'; categoryId: string; label: string }
  | { id: string; kind: 'brand'; brandId: string; label: string }
  | { id: string; kind: 'product'; productId: string; label: string }
  | { id: string; kind: 'collaborator'; collaboratorId: string; label: string }
  | { id: string; kind: 'link'; href: string; label: string };

export interface ResolvedNavItem {
  id: string;
  label: string;
  href: string;
  /**
   * Category items only: up to 3 products the admin pinned to this item, used
   * by the desktop hover dropdown and the mobile drill-down panel. Absent —
   * not empty — when the item has no dropdown, so `featured?.length` is the
   * single test for "does this item open a panel".
   */
  featured?: ResolvedProduct[];
}

export interface FooterColumn {
  id: string;
  title: string;
  links: Array<{ id: string; label: string; href: string }>;
}

export interface FooterConfig {
  tagline: string | null;
  newsletterEnabled: boolean;
  newsletterEyebrow: string;
  newsletterBlurb: string;
  columns: FooterColumn[];
  socials: Array<{ id: string; network: SocialNetwork; url: string }>;
  paymentBadges: PaymentBadge[];
  legalLine: string;
  secondaryLine: string;
}

/** Icon names the product page can render for a service promise. */
export type ProductPerkIcon = 'truck' | 'gift' | 'check' | 'heart' | 'grid';

/** Admin-editable service promises shown on every product page. */
export interface ProductSectionConfig {
  perks: Array<{ id: string; icon: ProductPerkIcon; text: string }>;
}

export interface ResolvedChrome {
  announcement: AnnouncementConfig;
  productSection: ProductSectionConfig;
  faviconUrl: string | null;
  navbar: {
    items: ResolvedNavItem[];
    showSearch: boolean;
    showAccount: boolean;
  };
  footer: FooterConfig;
}

/**
 * Used only when the API is unreachable (SSR fetch failure with no cached data). Deliberately
 * empty rather than a set of invented links: a dead backend must look plainly empty, not like a
 * shop with menu items and footer columns that 404.
 */
export const FALLBACK_CHROME: ResolvedChrome = {
  announcement: { enabled: false, messages: [], linkUrl: null, background: null },
  // Empty, like the rest of the fallback: a dead backend shows no promises
  // rather than stale ones the shop may no longer honour.
  productSection: { perks: [] },
  faviconUrl: null,
  navbar: { items: [], showSearch: true, showAccount: true },
  footer: {
    tagline: null,
    newsletterEnabled: false,
    newsletterEyebrow: '',
    newsletterBlurb: '',
    columns: [],
    socials: [],
    paymentBadges: [],
    legalLine: '',
    secondaryLine: '',
  },
};

// ── Fetchers ─────────────────────────────────────────────────────────────────
//
// Plain fetch, no `next: { revalidate }` — unlike the old settings/catalog clients. The
// Next.js Data Cache's time-based revalidation can't be busted by the backend when an admin
// saves, and it would fight the client-side poll below (first paint could be up to 60s stale
// even though the client refetches every 15-30s). The backend already caches these responses
// for 60s server-side and busts that cache on save, so a plain `cache: 'no-store'`-equivalent
// fetch (the App Router default for a fetch with no cache option outside `use cache`) is
// correct here: SSR always asks the backend, and the backend decides freshness.

async function storefrontFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/storefront${path}`);
  if (!res.ok) {
    throw new Error(`Failed to load storefront ${path}: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchStorefrontHome(): Promise<ResolvedHome> {
  return storefrontFetch<ResolvedHome>('/home');
}

export async function fetchStorefrontChrome(): Promise<ResolvedChrome> {
  return storefrontFetch<ResolvedChrome>('/chrome');
}

// ── Constant pages (Terms, Privacy, Shipping, Returns, …) ──────────────────

export interface StorefrontPageContent {
  slug: string;
  title: string;
  body: string;
}

/**
 * Fetches a single admin-authored constant page by slug. A missing/disabled page is a normal
 * 404 from the backend, not an error — returns `null` so the caller can render Next's not-found
 * UI instead of an error boundary. Any other non-OK status still throws.
 */
export async function fetchStorefrontPage(slug: string): Promise<StorefrontPageContent | null> {
  const res = await fetch(`${BASE}/storefront/pages/${encodeURIComponent(slug)}`, {
    next: { revalidate: 60 },
  });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`Failed to load storefront page "${slug}": ${res.status}`);
  }
  return res.json() as Promise<StorefrontPageContent>;
}

/* ── Spaces ──
   A space is a seller: MiniRue, or a partner like Helia. It owns brands and its
   own categories, and lives at /<slug>. Replaces the old /brands/<slug> route,
   where a partner WAS a single brand and the page hardcoded "Perfumes" above
   every one of them regardless of what they actually sold. */

export interface StorefrontSpace {
  /** null = MiniRue, which renders at the domain root rather than /minirue. */
  id: string | null;
  slug: string;
  name: string;
  kind: 'HOUSE' | 'PARTNER';
  description: string | null;
  logoUrl: string | null;
}

export interface StorefrontSpaceCategory {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  /** Already a servable URL — the backend resolves the gallery item and asks
   *  imgproxy for a 480px square, since these render as a grid on a phone. */
  imageUrl: string | null;
}

export interface StorefrontSpaceBrand {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
}

export interface StorefrontSpaceDetail {
  space: StorefrontSpace;
  categories: StorefrontSpaceCategory[];
  brands: StorefrontSpaceBrand[];
}

/** The space at /<slug>, or null when nothing lives there. */
export async function fetchSpace(slug: string): Promise<StorefrontSpaceDetail | null> {
  const res = await fetch(`${BASE}/storefront/spaces/${encodeURIComponent(slug)}`, {
    next: { revalidate: 60 },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load space "${slug}": ${res.status}`);
  return res.json() as Promise<StorefrontSpaceDetail>;
}

/** Every space a shopper can reach. Feeds the sitemap. */
export async function fetchSpaces(): Promise<StorefrontSpace[]> {
  const res = await fetch(`${BASE}/storefront/spaces`, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Failed to load spaces: ${res.status}`);
  const body = (await res.json()) as { data: StorefrontSpace[] };
  return body.data;
}

export type SpaceChild =
  | { space: StorefrontSpace; kind: 'category'; category: StorefrontSpaceCategory }
  | { space: StorefrontSpace; kind: 'product'; productId: string };

/**
 * What /<space>/<child> is. The URL alone cannot say whether /helia/jewellery
 * is a category or a product, so the server decides — category wins a tie.
 */
export async function fetchSpaceChild(
  slug: string,
  child: string,
): Promise<SpaceChild | null> {
  const res = await fetch(
    `${BASE}/storefront/spaces/${encodeURIComponent(slug)}/resolve/${encodeURIComponent(child)}`,
    { next: { revalidate: 60 } },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to resolve /${slug}/${child}: ${res.status}`);
  return res.json() as Promise<SpaceChild>;
}
