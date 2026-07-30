import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import type { Category } from '@/lib/api/catalog';

/**
 * One card per top-level category, image-led (owner: "have their images
 * section on each card better"), plus one extra card — "All Products" —
 * that is not a category at all, just a tile leading to the flat catalogue.
 * Visual language matches `app/brands/BrandsGrid.tsx` and
 * `app/collab/CollabGrid.tsx`: a square image tile over a label, no new
 * tokens invented for this page.
 */
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
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          // The one card that is deliberately not a photograph — "All
          // Products" is a shortcut tile, not a category, so it gets a
          // glyph on the same tinted square instead of an empty box that
          // would read as a missing image.
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

export default function CategoriesGrid({ categories }: { categories: Category[] }) {
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
          Shop
        </h1>
        <p style={{ color: 'var(--mr-fg-3)', maxWidth: '60ch', margin: 0 }}>
          Browse by category, or shop everything at once.
        </p>
      </header>

      <div
        data-trace-id="PG-STOREFRONT-CATIDX-001::EL-REGION-categories-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 'var(--mr-sp-4)',
        }}
      >
        {categories.map((category) => (
          <Tile
            key={category.id}
            href={`/categories/${category.slug}`}
            label={category.name}
            imageUrl={category.imageUrl ?? null}
            traceId="PG-STOREFRONT-CATIDX-001::EL-CARD-category-card"
          />
        ))}

        {/* The extra card the owner asked for — not a category, the flat
            all-products page — always last so the real categories read
            first. */}
        <Tile
          href="/products"
          label="All Products"
          imageUrl={null}
          traceId="PG-STOREFRONT-CATIDX-001::EL-CARD-all-products-card"
        />
      </div>
    </main>
  );
}
