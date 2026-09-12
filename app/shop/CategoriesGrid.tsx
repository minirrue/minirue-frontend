'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import GenericAvatarIcon from '@/components/ui/GenericAvatarIcon';
import RemoteImage from '@/components/ui/RemoteImage';
import UploadPreviewImage from '@/components/storefront/UploadPreviewImage';
import type { Category } from '@/lib/api/catalog';
import { categoryPath } from '@/lib/routes';

/**
 * One card per top-level category, image-led (owner: "have their images
 * section on each card better"), plus one extra card — "All Products" —
 * that is not a category at all, just a tile leading to the flat catalogue.
 * Visual language matches `app/brands/BrandsGrid.tsx` and
 * `app/collab/CollabGrid.tsx`: a square image tile over a label, no new
 * tokens invented for this page.
 */

/**
 * MiniRue's own uploaded logo, mirroring `SpaceView`'s header image (same
 * 64px square, same `objectFit: contain`) — this page is the "shop panel"
 * the bottom nav's Shop tab opens (2026-07-31 owner ask), and a partner's
 * space page already shows its logo this way. Unlike `SpaceView` (which
 * simply omits the image when there is none), this slot falls back to the
 * shared `GenericAvatarIcon` rather than rendering nothing — the same
 * never-a-broken-frame, never-an-initial-letter rule the chat avatar follows
 * — and also covers a logo URL that 404s/fails to load after the page has
 * already painted (`onError`), which a fetch-time `logoUrl === null` check
 * alone cannot catch.
 */
function ShopLogo({ logoUrl, shopName }: { logoUrl: string | null; shopName: string }) {
  const [errored, setErrored] = React.useState(false);
  React.useEffect(() => setErrored(false), [logoUrl]);

  if (logoUrl && !errored) {
    return (
      // Optimized (#11). A brand logo master is the widest file in the
      // gallery and this slot is 96px; going through the optimizer is the
      // difference between a full-size JPEG and a 96/192px AVIF. The
      // never-a-broken-frame rule below is unchanged — `RemoteImage` only
      // calls `onError` once the plain tag has failed too.
      <RemoteImage
        src={logoUrl}
        alt={shopName}
        width={96}
        height={96}
        onError={() => setErrored(true)}
        style={{ width: 96, height: 96, objectFit: 'contain', borderRadius: 4, flexShrink: 0 }}
      />
    );
  }

  return (
    <span
      data-testid="shop-panel-logo-generic"
      aria-label={`${shopName} — no logo`}
      style={{
        // Matches the <img> branch above exactly — a fallback that is a
        // different size to the thing it stands in for makes the header jump
        // as the logo resolves.
        width: 96,
        height: 96,
        borderRadius: 4,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--mr-bg-2, #f4f1ec)',
        color: 'var(--mr-fg-4)',
      }}
    >
      <GenericAvatarIcon size={28} />
    </span>
  );
}
function Tile({
  href,
  label,
  imageUrl,
  traceId,
}: {
  href: string;
  label: string;
  imageUrl: string | null;
  traceId: string;
}) {
  return (
    <Link
      href={href}
      data-trace-id={traceId}
      /* Full prefetch, unlike the product grid.
       *
       * Every shop route is dynamic, and a dynamic route's DEFAULT prefetch
       * stops at the nearest loading boundary — so without this the tap still
       * pays a full server round trip (see ShopRouteSkeleton). Affordable here
       * and not on a product grid: this panel is a handful of tiles and each
       * one is why the shopper opened the page, so the cost is bounded and the
       * hit rate is high. A 24-card grid would fire 24 full payloads on scroll,
       * which is why those warm on intent instead (usePrefetchOnIntent). */
      prefetch
      style={{ display: 'block', textDecoration: 'none', color: 'inherit', minWidth: 0 }}
    >
      <div
        style={{
          aspectRatio: '1 / 1',
          background: 'var(--mr-bg-2, #f4f1ec)',
          borderRadius: 6,
          overflow: 'hidden',
          marginBottom: 'var(--mr-sp-2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {imageUrl ? (
          // Never a bare image tag — a category picture is replaceable from
          // the dashboard, and the replacement lands on a brand-new
          // uuid-suffixed key whose first request is a guaranteed cold miss.
          // With no onError handler, one transient failure left this tile
          // broken for every shopper (owner, 2026-07-31).
          <UploadPreviewImage
            src={imageUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          // No picture chosen (or none set yet): a glyph on the same tinted
          // square, never an empty box that would read as a broken image.
          // Until 2026-08-03 the "All Products" and "Bundles" tiles could
          // ONLY land here — they had no cover field at all.
          <Icon name="grid" size={28} color="var(--mr-fg-4)" />
        )}
      </div>
      <span
        style={{
          fontFamily: 'var(--mr-font-label)',
          fontSize: 'var(--mr-text-xs)',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
    </Link>
  );
}

export default function CategoriesGrid({
  categories,
  shopName,
  shopLogoUrl,
  hasBundles = false,
  allProductsImageUrl = null,
  bundlesImageUrl = null,
}: {
  categories: Category[];
  /** MiniRue's own admin-configured name — falls back to "MiniRue" only for
   *  the logo's alt text/aria-label, never rendered as page copy (the "Shop"
   *  heading below is unchanged). `null`/omitted when the house-space fetch
   *  failed (see app/categories/page.tsx) — the logo slot then falls back to
   *  the generic icon exactly as it does for an admin who never uploaded one. */
  shopName?: string | null;
  shopLogoUrl?: string | null;
  /** True only when at least one live set exists — see app/categories/page.tsx. */
  hasBundles?: boolean;
  /**
   * Covers for the two tiles that are NOT categories. Owner ask 2026-08-03:
   * these rendered a glyph with no way to set a picture anywhere, while every
   * real category tile beside them had one. Set per space in the dashboard;
   * `null` keeps the glyph, so an admin who has chosen nothing sees exactly
   * what this page looked like before.
   */
  allProductsImageUrl?: string | null;
  bundlesImageUrl?: string | null;
}) {
  return (
    <main
      style={{
        maxWidth: 'var(--mr-content-max)',
        margin: '0 auto',
        /*
          Top and bottom are no longer the same number, and that is the point.

          Both were `clamp(48px,8vw,96px)`, so the gap between the navbar and
          the breadcrumb measured 96px on desktop and 48px on a phone — a full
          screen-inch of nothing above the first thing on the page, which read
          as the page having failed to load its top section (owner, on /shop).

          The bottom keeps the generous value: that one separates content from
          the footer and was never the complaint. Only the top shrinks, to a
          margin that reads as deliberate spacing under the nav rather than as
          a gap.

          The same pair is repeated across the eight other storefront index
          pages (shop/all, shop/[category], search, bundles, collab, …) because
          they each own their `<main>`. They were changed together — a shopper
          moving from /shop to /shop/perfumes would otherwise meet two different
          rhythms. It wants to be one token; it is not one yet because
          `mr-tokens.css` is being edited elsewhere.
        */
        padding: 'clamp(24px,3vw,40px) var(--mr-gutter) clamp(48px,8vw,96px)',
        minHeight: '60vh',
      }}
    >
      <nav
        aria-label="Breadcrumb"
        data-trace-id="PG-STOREFRONT-CATIDX-001::EL-REGION-breadcrumb-navigation"
        style={{
          fontFamily: 'var(--mr-font-label)',
          fontSize: 'var(--mr-text-xs)',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--mr-fg-4)',
          marginBottom: 'var(--mr-sp-6)',
          display: 'flex',
          gap: 'var(--mr-sp-2)',
          alignItems: 'center',
        }}
      >
        <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
          Home
        </Link>
        <span aria-hidden="true">/</span>
        <span style={{ color: 'var(--mr-fg-2)' }}>Shop</span>
      </nav>

      <header style={{ marginBottom: 'var(--mr-sp-7)' }}>
        {/* Logo beside the title, mirroring SpaceView's header exactly —
            this page is the "shop panel" the bottom nav's Shop tab opens
            (2026-07-31 owner ask: "brand logo... like collab page"). */}
        <div
          data-trace-id="PG-STOREFRONT-CATIDX-001::EL-REGION-shop-logo"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--mr-sp-4)',
            marginBottom: 'var(--mr-sp-4)',
            flexWrap: 'wrap',
          }}
        >
          <ShopLogo logoUrl={shopLogoUrl ?? null} shopName={shopName ?? 'MiniRue'} />
          <h1
            style={{
              fontFamily: 'var(--mr-font-serif)',
              fontWeight: 400,
              fontSize: 'clamp(var(--mr-text-2xl), 4vw, var(--mr-text-3xl))',
              lineHeight: 1.08,
              letterSpacing: '-0.006em',
              margin: 0,
            }}
          >
            Shop
          </h1>
        </div>
        <p style={{ color: 'var(--mr-fg-3)', maxWidth: '60ch', margin: 0 }}>
          Browse by category, or shop everything at once.
        </p>
      </header>

      <div
        data-trace-id="PG-STOREFRONT-CATIDX-001::EL-REGION-categories-grid"
        style={{
          display: 'grid',
          // Matched to the product grid on /shop/all
          // (CatalogProductGrid.tsx) so a category tile and a product card read at
          // the same scale. At 140px these were half the size of the products they
          // lead to, which made the shop landing page feel sparse beside the rest of
          // the storefront. The min(100%, …) guard keeps a single column from
          // overflowing on the narrowest phones.
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
          gap: 'var(--mr-sp-4)',
        }}
      >
        {categories.map((category) => (
          <Tile
            key={category.id}
            href={categoryPath(category.slug)}
            label={category.name}
            imageUrl={category.imageUrl ?? null}
            traceId="PG-STOREFRONT-CATIDX-001::EL-CARD-category-card"
          />
        ))}

        {/* Sets of products at one price. Sits immediately BEFORE All Products
            (owner: "beside all products"), and only exists when there is at
            least one live set — a card leading to an empty page is worse than
            no card at all. Same glyph treatment as All Products, because
            neither is a category and neither has a photograph of its own. */}
        {hasBundles && (
          <Tile
            href="/bundles"
            label="Bundles"
            imageUrl={bundlesImageUrl ?? null}
            traceId="PG-STOREFRONT-CATIDX-001::EL-CARD-bundles-card"
          />
        )}

        {/* The extra card the owner asked for — not a category, the flat
            all-products page — always last so the real categories read
            first. */}
        <Tile
          href="/shop/all"
          label="All Products"
          imageUrl={allProductsImageUrl ?? null}
          traceId="PG-STOREFRONT-CATIDX-001::EL-CARD-all-products-card"
        />
      </div>
    </main>
  );
}
