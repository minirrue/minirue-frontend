const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8002') + '/v1';

export interface PublicCollaboratorBrand {
  /** Needed to address a support conversation to this brand. */
  collaboratorId: string;
  brandSlug: string;
  brandName: string;
  logoUrl: string | null;
  description: string | null;
  storefrontHomeFeature?: boolean;
  storefrontNavLink?: boolean;
  storefrontVisible?: boolean;
  /**
   * Live PUBLISHED product count, rating average (rounded to one decimal) and
   * rating count — added for the Collab grid (`/collab`, Task AA) so it can
   * render a whole page of cards from this one request instead of one round
   * trip per partner. Optional because older cached payloads (Data Cache
   * revalidates every 15s) may not have them yet; absent reads the same as 0
   * everywhere this is rendered.
   */
  productCount?: number;
  /** null — not 0 — when nobody has reviewed anything of this partner's yet;
   * zero stars is not a rating anyone can give. */
  ratingAverage?: number | null;
  ratingCount?: number;
}

export interface CollaboratorBrandSection extends PublicCollaboratorBrand {
  products: import('@/lib/api/catalog').ApiProduct[];
}

export async function apiListPublicBrands(): Promise<PublicCollaboratorBrand[]> {
  const res = await fetch(`${BASE}/collab/brands`, {
    next: { revalidate: 15 },
  } as RequestInit);
  if (!res.ok) {
    throw new Error('Failed to load collaborator brands');
  }
  const json = (await res.json()) as { data: PublicCollaboratorBrand[] };
  return json.data;
}

export async function apiCheckCollaboratorBrandExists(
  brandSlug: string,
): Promise<boolean> {
  const res = await fetch(
    `${BASE}/collab/brands/${encodeURIComponent(brandSlug)}`,
  );
  if (!res.ok) {
    throw new Error('Failed to check collaborator brand');
  }
  const json = (await res.json()) as { exists: boolean };
  return json.exists;
}
