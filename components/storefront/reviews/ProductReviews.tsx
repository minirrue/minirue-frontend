'use client';

import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useClientQuery } from '@/lib/hooks/use-client-query';
import { useUser } from '@/lib/hooks/use-auth';
import MobileSheet from '@/components/ui/MobileSheet';
import StarRating from '@/components/storefront/StarRating';
import ReviewMediaStrip from './ReviewMediaStrip';
import WriteReviewSheet from './WriteReviewSheet';
import {
  apiGetProductReviews,
  apiGetReviewEligibility,
  type PublicReview,
} from '@/lib/api/reviews';

/** How many are shown inline before "read all" takes over. */
const INLINE_LIMIT = 3;

interface ProductReviewsProps {
  productId: string;
  productName: string;
  /** From the product response, so the summary paints with the page rather
   * than popping in after a request. */
  initialAverage: number | null;
  initialCount: number;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--mr-font-label)',
  fontSize: 'var(--mr-text-xs)',
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  color: 'var(--mr-fg-3)',
};

/**
 * Shared base for the two pill buttons in this section ("Read all N reviews"
 * and "Write a review"). Colour is the only per-button override, applied
 * AFTER this spread — spreading labelStyle (which carries its own
 * `color: var(--mr-fg-3)`) after an explicit colour silently overrides it,
 * which is how "Write a review" ended up grey-brown on its near-black
 * background instead of cream.
 */
const reviewButtonBaseStyle: React.CSSProperties = {
  padding: '14px 22px',
  minHeight: 44,
  borderRadius: 'var(--mr-radius-pill)',
  cursor: 'pointer',
  ...labelStyle,
};

function ReviewRow({ review }: { review: PublicReview }) {
  return (
    <article
      data-trace-id={`PG-STOREFRONT-CAT-005::EL-CARD-review@${review.id}`}
      style={{
        paddingBlock: 24,
        borderTop: '1px solid var(--mr-hairline)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 10,
        }}
      >
        <StarRating value={review.rating} size={14} />
        {review.verifiedPurchase ? (
          <span
            style={{
              ...labelStyle,
              fontSize: 11,
              letterSpacing: '0.16em',
              color: 'var(--mr-gold-700)',
            }}
          >
            Verified purchase
          </span>
        ) : null}
      </div>

      {review.title ? (
        <h3
          style={{
            margin: '0 0 6px',
            fontFamily: 'var(--mr-font-serif)',
            fontWeight: 400,
            fontSize: 'var(--mr-text-lg)',
            color: 'var(--mr-fg)',
            textWrap: 'balance',
          }}
        >
          {review.title}
        </h3>
      ) : null}

      {review.body ? (
        <p
          style={{
            margin: 0,
            color: 'var(--mr-fg-2)',
            lineHeight: 1.65,
            textWrap: 'pretty',
            maxWidth: '68ch',
          }}
        >
          {review.body}
        </p>
      ) : null}

      <ReviewMediaStrip media={review.media} />

      <div style={{ ...labelStyle, marginTop: 12, fontSize: 11 }}>
        {formatDate(review.createdAt)}
      </div>
    </article>
  );
}

export default function ProductReviews({
  productId,
  productName,
  initialAverage,
  initialCount,
}: ProductReviewsProps) {
  const [allOpen, setAllOpen] = React.useState(false);
  const [writeOpen, setWriteOpen] = React.useState(false);
  const queryClient = useQueryClient();
  const { data: user } = useUser();

  const listKey = React.useMemo(
    () => ['reviews', 'product', productId] as const,
    [productId],
  );

  // The first few are fetched with the section; the rest only when the sheet
  // opens, since most shoppers never open it.
  const { data: listing } = useClientQuery({
    queryKey: listKey,
    queryFn: () => apiGetProductReviews(productId, { limit: 20 }),
    staleTime: 1000 * 60,
  });

  const { data: eligibility } = useClientQuery({
    queryKey: ['reviews', 'eligibility', productId],
    queryFn: () => apiGetReviewEligibility(productId),
    enabled: !!user,
    retry: false,
  });

  // Prefer the freshly fetched numbers; fall back to what the page was built
  // with so the summary is never blank on first paint.
  const average = listing?.average ?? initialAverage;
  const count = listing?.count ?? initialCount;
  const items = listing?.items ?? [];
  const canWrite = !!eligibility?.eligible;

  function onWritten() {
    void queryClient.invalidateQueries({ queryKey: listKey });
    void queryClient.invalidateQueries({
      queryKey: ['reviews', 'eligibility', productId],
    });
  }

  return (
    <section
      data-trace-id="PG-STOREFRONT-CAT-005::EL-REGION-product-reviews"
      className="px-[clamp(20px,5vw,32px)] py-[clamp(48px,12vw,96px)] lg:px-[clamp(32px,4vw,64px)]"
      style={{ background: 'var(--mr-cream-100)' }}
      aria-labelledby="reviews-heading"
    >
      <h2 id="reviews-heading" style={{ ...labelStyle, margin: '0 0 20px' }}>
        What people say
      </h2>

      {count > 0 ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 14,
            flexWrap: 'wrap',
            marginBottom: 4,
          }}
        >
          <span
            className="mr-num"
            style={{
              fontFamily: 'var(--mr-font-serif)',
              fontSize: 'var(--mr-text-2xl)',
              color: 'var(--mr-fg)',
              lineHeight: 1,
            }}
          >
            {average?.toFixed(1)}
          </span>
          <StarRating value={average ?? 0} size={16} />
          <span style={{ color: 'var(--mr-fg-2)' }}>
            {count === 1 ? '1 review' : `${count} reviews`}
          </span>
        </div>
      ) : (
        // Never an empty box: say what would be here and who can put it there.
        <p style={{ margin: '0 0 8px', color: 'var(--mr-fg-2)', lineHeight: 1.6 }}>
          {canWrite
            ? 'No reviews yet — yours would be the first.'
            : 'No reviews yet. Only customers who have received this can write one.'}
        </p>
      )}

      {items.slice(0, INLINE_LIMIT).map((review) => (
        <ReviewRow key={review.id} review={review} />
      ))}

      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          marginTop: items.length ? 24 : 16,
        }}
      >
        {count > INLINE_LIMIT ? (
          <button
            type="button"
            onClick={() => setAllOpen(true)}
            data-trace-id="PG-STOREFRONT-CAT-005::EL-BTN-read-all-reviews"
            style={{
              ...reviewButtonBaseStyle,
              border: '1px solid var(--mr-border)',
              background: 'transparent',
              color: 'var(--mr-fg)',
            }}
          >
            Read all {count} reviews
          </button>
        ) : null}

        {canWrite ? (
          <button
            type="button"
            onClick={() => setWriteOpen(true)}
            data-trace-id="PG-STOREFRONT-CAT-005::EL-BTN-write-review"
            style={{
              ...reviewButtonBaseStyle,
              border: 0,
              background: 'var(--mr-ink-900)',
              boxShadow: 'var(--mr-shadow-md)',
              color: 'var(--mr-cream-100)',
            }}
          >
            Write a review
          </button>
        ) : null}
      </div>

      {eligibility?.alreadyReviewed ? (
        <p
          style={{
            margin: '16px 0 0',
            color: 'var(--mr-fg-3)',
            fontSize: 'var(--mr-text-sm)',
          }}
        >
          {eligibility.existingStatus === 'APPROVED'
            ? 'Your review of this is on the shop. Thank you.'
            : 'Your review is with us and appears once it has been read.'}
        </p>
      ) : null}

      <MobileSheet
        open={allOpen}
        onClose={() => setAllOpen(false)}
        title={`${count} ${count === 1 ? 'review' : 'reviews'}`}
        traceId="PG-STOREFRONT-CAT-005::EL-REGION-all-reviews"
      >
        {items.map((review) => (
          <ReviewRow key={review.id} review={review} />
        ))}
      </MobileSheet>

      <WriteReviewSheet
        open={writeOpen}
        onClose={() => setWriteOpen(false)}
        productId={productId}
        productName={productName}
        onWritten={onWritten}
      />
    </section>
  );
}
