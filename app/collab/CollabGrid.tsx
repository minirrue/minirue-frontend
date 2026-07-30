import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import type { PublicCollaboratorBrand } from '@/lib/api/collaborators';

/**
 * One card per partner: logo as the thumbnail, star rating + number of
 * ratings, and how many products they carry — the exact shape the owner
 * described ("cards with rating and number of rating under each one and how
 * much product they have inside... shaped from collab logo... in card
 * thumbnail"). Tapping goes straight to the partner's own root-level space
 * (`/{slug}`), matching `app/brands/BrandsGrid.tsx`'s tile treatment.
 */
function CollabCard({ brand }: { brand: PublicCollaboratorBrand }) {
  const rating = brand.ratingAverage ?? null;
  const ratingCount = brand.ratingCount ?? 0;
  const productCount = brand.productCount ?? 0;

  return (
    <Link
      href={`/${brand.brandSlug}`}
      data-trace-id="PG-STOREFRONT-COLLAB-001::EL-CARD-collab-card"
      style={{ display: 'block', textDecoration: 'none', color: 'inherit', minWidth: 0 }}
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
        {brand.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brand.logoUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : null}
      </div>

      <span
        style={{
          display: 'block',
          fontFamily: 'var(--mr-font-label)',
          fontSize: 'var(--mr-text-xs)',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}
      >
        {brand.brandName}
      </span>

      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          marginTop: 4,
          color: 'var(--mr-fg-3)',
          fontSize: 'var(--mr-text-xs)',
        }}
      >
        <Icon name="star" size={12} color="var(--mr-gold-400, #b8965a)" />
        {rating != null ? (
          <>
            {rating.toFixed(1)}
            <span aria-hidden="true">·</span>
            <span>
              {ratingCount} {ratingCount === 1 ? 'rating' : 'ratings'}
            </span>
          </>
        ) : (
          <span>No ratings yet</span>
        )}
      </span>

      <span
        style={{
          display: 'block',
          marginTop: 2,
          color: 'var(--mr-fg-4)',
          fontSize: 'var(--mr-text-xs)',
        }}
      >
        {productCount} {productCount === 1 ? 'product' : 'products'}
      </span>
    </Link>
  );
}

export default function CollabGrid({ brands }: { brands: PublicCollaboratorBrand[] }) {
  return (
    <main
      style={{
        maxWidth: 'var(--mr-content-max)',
        margin: '0 auto',
        padding: 'clamp(48px,8vw,96px) var(--mr-gutter)',
        minHeight: '60vh',
      }}
    >
      <nav
        aria-label="Breadcrumb"
        data-trace-id="PG-STOREFRONT-COLLAB-001::EL-REGION-breadcrumb-navigation"
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
        <span style={{ color: 'var(--mr-fg-2)' }}>Collab</span>
      </nav>

      <header style={{ marginBottom: 'var(--mr-sp-7)' }}>
        <h1
          style={{
            fontFamily: 'var(--mr-font-serif)',
            fontWeight: 400,
            fontSize: 'clamp(var(--mr-text-2xl), 4vw, var(--mr-text-3xl))',
            lineHeight: 1.08,
            letterSpacing: '-0.006em',
            margin: '0 0 var(--mr-sp-2)',
          }}
        >
          Collab
        </h1>
        <p style={{ color: 'var(--mr-fg-3)', maxWidth: '60ch', margin: 0 }}>
          Every maison and partner atelier MiniRue collaborates with, each with its own shop.
        </p>
      </header>

      {brands.length > 0 ? (
        <div
          data-trace-id="PG-STOREFRONT-COLLAB-001::EL-REGION-collab-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 'var(--mr-sp-4)',
          }}
        >
          {brands.map((brand) => (
            <CollabCard key={brand.collaboratorId} brand={brand} />
          ))}
        </div>
      ) : (
        <p style={{ color: 'var(--mr-fg-3)', fontStyle: 'italic', margin: 0 }}>
          No collaborators yet.
        </p>
      )}
    </main>
  );
}
