import { cache } from 'react';
import { apiGetProductReviews } from '@/lib/api/reviews';
import type { PublicReview } from '@/lib/api/reviews';

/**
 * Reviews for the product page's JSON-LD `review` entries (ProductSchema),
 * deduped per request via React's cache() — mirrors the pattern in
 * app/search/search-data.ts. Only one caller today (this page's server
 * component), but wrapping it means a second future server-side caller in
 * the same request (e.g. generateMetadata wanting a review count) costs no
 * extra round trip.
 *
 * This is separate from `ProductReviews` (components/storefront/reviews),
 * which is a Client Component that fetches its own copy via react-query for
 * interactivity (pagination, "write a review", live invalidation after
 * submit). That client fetch is not reusable here — this page intentionally
 * does not prefetch into React Query / HydrationBoundary any more (see the
 * NOTE in page.tsx about the Cache Components resume bug that caused), so a
 * dedicated server-side fetch for the schema is unavoidable and additive,
 * not a duplicate of an existing shared one.
 *
 * Failures return an empty list rather than throwing — a reviews outage
 * must not take the whole product page down with it.
 */
export const getProductReviewsForSchema = cache(
  async (productId: string): Promise<PublicReview[]> => {
    try {
      const listing = await apiGetProductReviews(productId, { limit: 20 });
      return listing.items;
    } catch {
      return [];
    }
  },
);
