import { cacheLife, cacheTag } from 'next/cache';

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
  'use cache';
  cacheLife({ stale: 300, revalidate: 900, expire: 86400 });
  cacheTag('settings');

  const res = await fetch(`${BASE}/settings/public`);
  if (!res.ok) {
    throw new Error('Failed to load store settings');
  }
  return res.json() as Promise<PublicSettings>;
}
