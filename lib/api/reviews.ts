import { apiFetch } from './client';

export interface ReviewMedia {
  id: string;
  kind: 'IMAGE' | 'VIDEO';
  /** Resolved server-side at read time — images through imgproxy, videos as a
   * freshly signed link. Null when storage could not resolve it. */
  url: string | null;
  contentType: string;
}

/** What the shop is given. No name, no customer id — a review is an opinion
 * about a product, not a public record of who bought what. */
export interface PublicReview {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  verifiedPurchase: boolean;
  createdAt: string;
  media: ReviewMedia[];
}

export interface ReviewListing {
  items: PublicReview[];
  average: number | null;
  count: number;
}

export interface ReviewEligibility {
  eligible: boolean;
  alreadyReviewed: boolean;
  existingReviewId: string | null;
  existingStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
}

export interface CreateReviewInput {
  productId: string;
  rating: number;
  title?: string;
  body?: string;
}

export async function apiGetProductReviews(
  productId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<ReviewListing> {
  const params = new URLSearchParams();
  if (opts.limit != null) params.set('limit', String(opts.limit));
  if (opts.offset != null) params.set('offset', String(opts.offset));
  const qs = params.toString();
  return apiFetch(`/reviews/product/${productId}${qs ? `?${qs}` : ''}`);
}

export async function apiGetReviewEligibility(
  productId: string,
): Promise<ReviewEligibility> {
  return apiFetch(`/reviews/eligibility/${productId}`);
}

export async function apiCreateReview(
  input: CreateReviewInput,
): Promise<{ id: string; status: string; message: string }> {
  return apiFetch('/reviews', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * One file per call. A phone on a slow connection is far likelier to finish
 * four 8MB uploads than one 32MB one, and a failure then costs one photo
 * rather than all of them.
 *
 * No Content-Type header — the browser has to set the multipart boundary
 * itself, and setting it by hand is what silently breaks the upload.
 */
export async function apiAttachReviewMedia(
  reviewId: string,
  file: File,
): Promise<{ media: ReviewMedia[] }> {
  const form = new FormData();
  form.append('file', file);
  return apiFetch(`/reviews/${reviewId}/media`, {
    method: 'POST',
    body: form,
  });
}
