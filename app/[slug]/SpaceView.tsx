import Link from 'next/link';
import type {
  StorefrontSpace,
  StorefrontSpaceBrand,
  StorefrontSpaceCategory,
} from '@/lib/api/storefront';

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
          // eslint-disable-next-line @next/next/no-img-element
          <img
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

export default function SpaceView({
  space,
  categories,
  brands,
}: {
  space: StorefrontSpace;
  categories: StorefrontSpaceCategory[];
  brands: StorefrontSpaceBrand[];
}) {
  const base = space.kind === 'HOUSE' ? '' : `/${space.slug}`;

  return (
    <main
      style={{
        maxWidth: 'var(--mr-content-max)',
        margin: '0 auto',
        padding: 'clamp(48px,8vw,96px) var(--mr-gutter)',
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
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={space.logoUrl}
              alt=""
              width={64}
              height={64}
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

      {brands.length > 0 && (
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
            {brands.map((b) => (
              <Tile
                key={b.id}
                href={`/products?brand=${encodeURIComponent(b.name)}`}
                label={b.name}
                imageUrl={b.imageUrl}
              />
            ))}
          </TileGrid>
        </section>
      )}

      {categories.length === 0 && brands.length === 0 && (
        <p style={{ color: 'var(--mr-fg-3)', fontStyle: 'italic' }}>
          Nothing here yet.
        </p>
      )}
    </main>
  );
}
