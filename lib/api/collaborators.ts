const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8002') + '/v1';

export interface PublicCollaboratorBrand {
  brandSlug: string;
  brandName: string;
  logoUrl: string | null;
  description: string | null;
  storefrontHomeFeature?: boolean;
  storefrontNavLink?: boolean;
}

export interface CollaboratorBrandSection extends PublicCollaboratorBrand {
  products: import('@/lib/api/catalog').ApiProduct[];
}

export async function apiListPublicBrands(): Promise<PublicCollaboratorBrand[]> {
  const res = await fetch(`${BASE}/collab/brands`);
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
