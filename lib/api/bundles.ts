import { apiFetch } from './client';

/** A set of products sold together at one price. */
export interface BundleMember {
  productId: string;
  variantId: string | null;
  productName: string;
  productSlug: string;
  brandName: string;
  quantity: number;
  unitMinor: number;
  /** This member's share of the set price, allocated so the parts sum exactly. */
  allocatedMinor: number;
}

export interface Bundle {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  priceMinor: number;
  currency: string;
  /** What the members cost bought separately — computed live, never stored. */
  listTotalMinor: number;
  savingMinor: number;
  inStock: boolean;
  members: BundleMember[];
}

export async function listBundles(): Promise<Bundle[]> {
  const res = await apiFetch<{ data: Bundle[] }>('/bundles');
  return res.data;
}

export async function getBundle(slug: string): Promise<Bundle> {
  return apiFetch<Bundle>(`/bundles/${encodeURIComponent(slug)}`);
}

/**
 * How many sets exist for a shopper to see.
 *
 * The Shop page calls this to decide whether the Bundles tile appears at all —
 * the owner's rule is that the card only exists once there is at least one set.
 * A dedicated count endpoint rather than fetching every set, because this sits
 * on the render path of a page that must not slow down for a feature that may
 * be empty.
 */
export async function countBundles(): Promise<number> {
  const res = await apiFetch<{ count: number }>('/bundles/count');
  return res.count;
}
