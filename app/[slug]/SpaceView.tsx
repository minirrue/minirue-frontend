import Link from 'next/link';
import type {
  StorefrontShopPanel,
  StorefrontSpace,
  StorefrontSpaceBrand,
  StorefrontSpaceCategory,
} from '@/lib/api/storefront';
import { catalog } from '@/lib/api/catalog';
import type { ApiProduct } from '@/lib/api/catalog';
import CatalogProductGrid from '@/components/storefront/CatalogProductGrid';
import UploadPreviewImage from '@/components/storefront/UploadPreviewImage';

/**
 * A seller's own corner of the shop.
 *
 * Replaces the old brand page, which showed a hardcoded "Perfumes" above every
 * brand — Helia sells jewellery, and the crumb said Perfumes anyway. There is
 * no category above a seller now, because a category and a seller are two
 * different ways of looking at the same product, not levels of one tree.
 *
 * Categories and brands are shown as image tiles rather than text links: the
 * owner's requirement (2026-07-29) is that a customer browses by picture.
 *
 * A brand tile used to link to `/products?brand=<name>` regardless of which
 * space it belonged to — name-based (fragile: two spaces can share a brand
 * name) and space-leaking (it sent a partner's shopper out into the house
 * listing). A partner brand now links inside its own space; the house still
 * uses `/products`, scoped by the real `brandId`.
 *
 * The space's own no-brand bucket (`isGeneric`) never gets a brand tile — the
 * word "Generic" is an internal name only and must never reach a shopper.
 * Its products render instead as a category-style section, using the
 * bucket's own admin-edited description/image as that section's blurb and
 * picture, so this is admin-controlled content, not a hardcoded string.
 */

function Breadcrumb({ space }: { space: StorefrontSpace }) {
  return (
    <nav
      aria-label="Breadcrumb"
      data-trace-id="PG-STOREFRONT-SPACE-001::EL-REGION-breadcrumb-navigation"
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
        flexWrap: 'wrap',
      }}
    >
      <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
        Home
      </Link>
      <span aria-hidden="true">/</span>
      <span style={{ color: 'var(--mr-fg-2)' }}>{space.name}</span>
    </nav>
  );
}

/** One picture tile. Falls back to the name on its own when there is no image. */
function Tile({
  href,
  label,
  imageUrl,
}: {
  href: string;
  label: string;
  imageUrl: string | null;
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        minWidth: 0,
      }}
    >
      <div
        style={{
          aspectRatio: '1 / 1',
          background: 'var(--mr-bg-2, #f4f1ec)',
          borderRadius: 6,
          overflow: 'hidden',
          marginBottom: 'var(--mr-sp-2)',
        }}
      >
        {imageUrl ? (
          // Never a bare image tag — these tiles are categories and brands,
          // both replaceable from the dashboard, and a replacement lands on a
          // brand-new uuid-suffixed key whose first request is a guaranteed
          // cold miss. See app/brands/BrandsGrid.tsx's Tile for the full note.
          <UploadPreviewImage
            src={imageUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : null}
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

function TileGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        // Fits from 320px up without a media query; the tiles simply rewrap.
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: 'var(--mr-sp-4)',
        marginBottom: 'var(--mr-sp-7)',
      }}
    >
      {children}
    </div>
  );
}

export default async function SpaceView({
  space,
  categories,
  brands,
  shopPanel,
}: {
  space: StorefrontSpace;
  categories: StorefrontSpaceCategory[];
  brands: StorefrontSpaceBrand[];
  /** Covers for the shortcut tiles — see the "Everything" section below.
   *  Optional: an older API build omits it and the tile keeps its glyph. */
  shopPanel?: StorefrontShopPanel;
}) {
  const base = space.kind === 'HOUSE' ? '' : `/${space.slug}`;

  // Generic is a collection, never a brand tile — see the note above.
  const brandTiles = brands.filter((b) => !b.isGeneric);
  const genericBrand = brands.find((b) => b.isGeneric) ?? null;
  const genericHeading =
    space.kind === 'HOUSE' ? 'MiniRue Selects' : `More from ${space.name}`;

  let genericProducts: ApiProduct[] = [];
  if (genericBrand) {
    try {
      const res = await catalog.listProducts({ brandId: genericBrand.id, limit: 12 });
      genericProducts = res.data;
    } catch {
      // API unavailable — the section still renders its blurb/picture below
    }
  }

  return (
    <main
      style={{
        maxWidth: 'var(--mr-content-max)',
        margin: '0 auto',
        padding: 'clamp(48px,8vw,96px) var(--mr-gutter)',
        /* A space with no categories and no brands yet has almost nothing to
           render, and without a floor the footer rode straight up under the
           navbar — the page read as broken rather than as new. 60vh keeps a
           full screen under the header whatever the space holds. */
        minHeight: '60vh',
      }}
    >
      <Breadcrumb space={space} />

      <header style={{ marginBottom: 'var(--mr-sp-7)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--mr-sp-4)',
            marginBottom: 'var(--mr-sp-4)',
            flexWrap: 'wrap',
          }}
        >
          {space.logoUrl ? (
            <UploadPreviewImage
              src={space.logoUrl}
              alt=""
              // 96, not 64 (owner, 2026-07-31: "make it bigger like 50% more").
              // Kept in lockstep with the house shop panel's ShopLogo in
              // app/categories/CategoriesGrid.tsx — the two are meant to be
              // indistinguishable, so changing one alone is the bug.
              width={96}
              height={96}
              style={{ objectFit: 'contain', borderRadius: 4 }}
            />
          ) : null}
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
            {space.name}
          </h1>
        </div>
        {space.description ? (
          <p style={{ color: 'var(--mr-fg-3)', maxWidth: '60ch', margin: 0 }}>
            {space.description}
          </p>
        ) : null}
      </header>

      {categories.length > 0 && (
        <section>
          <h2
            style={{
              fontFamily: 'var(--mr-font-label)',
              fontSize: 'var(--mr-text-xs)',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--mr-fg-4)',
              marginBottom: 'var(--mr-sp-4)',
            }}
          >
            Shop by category
          </h2>
          <TileGrid>
            {categories.map((c) => (
              <Tile
                key={c.id}
                href={`${base}/${c.slug}`}
                label={c.name}
                imageUrl={c.imageUrl}
              />
            ))}
          </TileGrid>
        </section>
      )}

      {/* One tile leading to every product in this space.
          Owner ask 2026-08-03: "unify business over minirue and collab, have
          same mindset here" — MiniRue's shop panel has had an All Products
          shortcut since 2026-07-31 and a partner's space had none, so a
          shopper's route to "just show me everything" depended on whose shop
          they were standing in.

          It is NOT the Generic section further down: generic means products
          with no brand, while this is every product whether it has a brand or
          not (owner, same day, correcting exactly that confusion).

          Rendered before Brands so "everything" reads as the widest option
          first, and only when the space actually has products to show — a tile
          leading to an empty page is worse than no tile, the same rule the
          Bundles card follows on MiniRue's own panel. */}
      {(categories.length > 0 || brands.length > 0) && (
        <section>
          <h2
            style={{
              fontFamily: 'var(--mr-font-label)',
              fontSize: 'var(--mr-text-xs)',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--mr-fg-4)',
              marginBottom: 'var(--mr-sp-4)',
            }}
          >
            Everything
          </h2>
          <TileGrid>
            <Tile
              href={
                space.kind === 'HOUSE'
                  ? '/products'
                  : `/products?space=${encodeURIComponent(space.slug)}`
              }
              label="All Products"
              imageUrl={shopPanel?.allProductsImageUrl ?? null}
            />
          </TileGrid>
        </section>
      )}

      {brandTiles.length > 0 && (
        <section>
          <h2
            style={{
              fontFamily: 'var(--mr-font-label)',
              fontSize: 'var(--mr-text-xs)',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--mr-fg-4)',
              marginBottom: 'var(--mr-sp-4)',
            }}
          >
            Brands
          </h2>
          <TileGrid>
            {brandTiles.map((b) => (
              <Tile
                key={b.id}
                href={
                  space.kind === 'HOUSE'
                    ? `/products?brandId=${b.id}`
                    : `${base}/${b.slug}`
                }
                label={b.name}
                imageUrl={b.imageUrl}
              />
            ))}
          </TileGrid>
        </section>
      )}

      {genericBrand && (
        <section>
          <h2
            style={{
              fontFamily: 'var(--mr-font-label)',
              fontSize: 'var(--mr-text-xs)',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--mr-fg-4)',
              marginBottom: 'var(--mr-sp-4)',
            }}
          >
            {genericHeading}
          </h2>
          {(genericBrand.imageUrl || genericBrand.description) && (
            <div
              style={{
                display: 'flex',
                gap: 'var(--mr-sp-4)',
                alignItems: 'center',
                marginBottom: 'var(--mr-sp-4)',
                flexWrap: 'wrap',
              }}
            >
              {genericBrand.imageUrl ? (
                <UploadPreviewImage
                  src={genericBrand.imageUrl}
                  alt=""
                  style={{
                    width: 96,
                    height: 96,
                    objectFit: 'cover',
                    borderRadius: 6,
                    flexShrink: 0,
                  }}
                />
              ) : null}
              {genericBrand.description ? (
                <p style={{ color: 'var(--mr-fg-3)', maxWidth: '60ch', margin: 0 }}>
                  {genericBrand.description}
                </p>
              ) : null}
            </div>
          )}
          <CatalogProductGrid
            products={genericProducts}
            emptyMessage={`Nothing in ${genericHeading} yet.`}
            listTraceId="PG-STOREFRONT-SPACE-001::EL-LIST-generic-product-grid"
            cardTraceIdPrefix="PG-STOREFRONT-SPACE-001::EL-CARD-product-card"
          />
        </section>
      )}

      {categories.length === 0 && brandTiles.length === 0 && !genericBrand && (
        <p style={{ color: 'var(--mr-fg-3)', fontStyle: 'italic', margin: 0 }}>
          {space.kind === 'PARTNER'
            ? `${space.name} has not added any categories or brands yet.`
            : 'Nothing here yet.'}
        </p>
      )}
    </main>
  );
}
