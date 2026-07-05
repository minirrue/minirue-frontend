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
  storeName: string;
  currency: string;
  logoUrl: string | null;
  storefront: StorefrontPublicSettings;
}

export async function apiGetPublicSettings(): Promise<PublicSettings> {
  const res = await fetch(`${BASE}/settings/public`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    throw new Error('Failed to load store settings');
  }
  return res.json() as Promise<PublicSettings>;
}
