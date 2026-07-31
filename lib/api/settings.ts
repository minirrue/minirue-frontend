const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8002') + '/v1';

export interface HeroSlideConfig {
  id: number;
  type: 'photo' | 'editorial';
  eyebrow: string;
  headline: string;
  sub: string;
  tagline: string;
  bg: string;
  bottle?: string;
  cap?: string;
  tile?: string;
}

export interface StorefrontPublicSettings {
  announcementEnabled: boolean;
  announcementMessages: string[];
  announcementLinkUrl?: string | null;
  announcementBackground?: string | null;
  faviconUrl: string | null;
  footerTagline: string | null;
  heroSlides: HeroSlideConfig[];
}

export interface PublicSettings {
  /** Constant, not an editable setting — the shop's fixed legal name. */
  storeName: string;
  /**
   * The ONE admin-editable shop display name (2026-07-31 owner ask) — the
   * chat widget's header/sender name reads this rather than a hardcoded
   * "MiniRue Support" literal. Never empty: falls back server-side to
   * `DEFAULT_SHOP_DISPLAY_NAME` ("MiniRue") when unset.
   */
  displayName: string;
  currency: string;
  logoUrl: string | null;
  storefront: StorefrontPublicSettings;
}

export async function apiGetPublicSettings(): Promise<PublicSettings> {
  // 60s revalidate (Next.js Data Cache) — plain fetch option, safe from both
  // Server and Client Components, unlike the 'use cache' directive.
  const res = await fetch(`${BASE}/settings/public`, {
    next: { revalidate: 60 },
  } as RequestInit);
  if (!res.ok) {
    throw new Error('Failed to load store settings');
  }
  return res.json() as Promise<PublicSettings>;
}
