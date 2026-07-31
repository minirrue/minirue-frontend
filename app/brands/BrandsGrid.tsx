import Link from 'next/link';
import UploadPreviewImage from '@/components/storefront/UploadPreviewImage';
import type { PublicCollaboratorBrand } from '@/lib/api/collaborators';

/**
 * Picture-and-name tiles, matching the visual language of `app/[slug]/SpaceView.tsx`
 * (the same treatment a space gives its own categories and brands) — no new
 * tokens invented for this page.
 */
function Tile({ href, label, imageUrl }: { href: string; label: string; imageUrl: string | null }) {
  return (
    <Link href={href} style={{ display: 'block', textDecoration: 'none', color: 'inherit', minWidth: 0 }}>
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
          // Never a bare image tag. A brand picture is replaceable from the
          // dashboard, and a replacement lands on a brand-new uuid-suffixed
          // key — so the first request for it is a guaranteed cold miss
          // through Cloudflare -> nginx -> imgproxy -> Garage. With no onError
          // handler, one transient failure left this tile broken for every
          // shopper until they happened to hard-reload (owner, 2026-07-31).
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

export default function BrandsGrid({ brands }: { brands: PublicCollaboratorBrand[] }) {
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
        data-trace-id="PG-STOREFRONT-BRANDS-001::EL-REGION-breadcrumb-navigation"
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
        <span style={{ color: 'var(--mr-fg-2)' }}>Brands</span>
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
          Brands
        </h1>
        <p style={{ color: 'var(--mr-fg-3)', maxWidth: '60ch', margin: 0 }}>
          Every maison and partner atelier selling on MiniRue, each with its own shop.
        </p>
      </header>

      {brands.length > 0 ? (
        <div
          data-trace-id="PG-STOREFRONT-BRANDS-001::EL-REGION-brands-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 'var(--mr-sp-4)',
          }}
        >
          {brands.map((brand) => (
            <Tile
              key={brand.collaboratorId}
              href={`/${brand.brandSlug}`}
              label={brand.brandName}
              imageUrl={brand.logoUrl}
            />
          ))}
        </div>
      ) : (
        <p style={{ color: 'var(--mr-fg-3)', fontStyle: 'italic', margin: 0 }}>
          No brands yet.
        </p>
      )}
    </main>
  );
}
