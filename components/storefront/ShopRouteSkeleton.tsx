import CatalogProductGridSkeleton from '@/components/storefront/CatalogProductGridSkeleton';

/**
 * The loading shell every /shop route shows the instant a link is tapped.
 *
 * Why it exists at all, and why it is load-bearing rather than decoration:
 *
 * Every shop route is DYNAMIC — each one calls `connection()` or sets
 * `force-dynamic`, deliberately, to dodge the Cache Components resume bug
 * documented in next.config.ts. Next's default prefetch on a dynamic route only
 * fetches down to the nearest `loading.js` boundary. This app had NO loading
 * boundaries anywhere, so there was nothing for a prefetch to fetch and nothing
 * to paint on tap: every navigation was a cold server round trip that left the
 * previous page frozen on screen until it finished.
 *
 * That is the "1 sec or 2 sec stale on tap" the owner reported (2026-08-21).
 * Adding the boundary fixes both halves at once — the shopper sees the shell
 * immediately, and prefetch finally has a target.
 *
 * Deliberately reuses CatalogProductGridSkeleton rather than inventing a second
 * set of grey boxes, so the shell and the real grid share one definition of
 * what a product card's proportions are.
 */
export default function ShopRouteSkeleton({
  /** Matches the heading height the real page renders, so the grid does not
   *  jump upward when the content arrives. */
  showHeading = true,
  count = 8,
}: {
  showHeading?: boolean;
  count?: number;
}) {
  return (
    <div
      style={{
        maxWidth: 'var(--mr-content-max)',
        margin: '0 auto',
        padding: 'var(--mr-sp-7) var(--mr-gutter) var(--mr-sp-9)',
      }}
    >
      {showHeading && (
        <div style={{ marginBottom: 'var(--mr-sp-7)' }}>
          <div
            className="mr-skeleton-pulse"
            style={{
              width: 120,
              height: 12,
              borderRadius: 2,
              background: 'var(--mr-cream-300)',
              marginBottom: 'var(--mr-sp-4)',
            }}
          />
          <div
            className="mr-skeleton-pulse"
            style={{
              width: 'min(320px, 60%)',
              height: 34,
              borderRadius: 4,
              background: 'var(--mr-cream-300)',
            }}
          />
        </div>
      )}
      <CatalogProductGridSkeleton count={count} />
    </div>
  );
}
