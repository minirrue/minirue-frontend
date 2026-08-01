import type { Metadata } from 'next';
import { connection } from 'next/server';
import Link from 'next/link';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import FooterWithSettings from '@/components/layout/FooterWithSettings';
import HeaderWrapper from '@/app/products/HeaderWrapper';
import UploadPreviewImage from '@/components/storefront/UploadPreviewImage';
import Icon from '@/components/ui/Icon';
import { listBundles, type Bundle } from '@/lib/api/bundles';

/**
 * `/bundles` — sets of products sold together at one price.
 *
 * Reached from the Bundles tile on `/categories` (the "Shop" page the phone's
 * bottom nav opens), which only appears when at least one set exists. Sets do
 * not appear in `/products` or in search: the flat catalogue stays a list of
 * single products, so a shopper counting items is never counting the same
 * candle twice.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Bundles — MiniRue',
  description: 'Sets of MiniRue pieces, chosen together and priced as one.',
  alternates: { canonical: '/bundles' },
};

function minorToAmount(minor: number): string {
  return (minor / 100).toFixed(2);
}

export default async function BundlesIndexPage() {
  await connection();

  let bundles: Bundle[] = [];
  try {
    bundles = await listBundles();
  } catch {
    // Same graceful degradation as every other storefront route: an empty page
    // rather than an error screen.
  }

  return (
    <>
      <div className="mr-page-sheet">
        <AnnouncementBar />
        <HeaderWrapper />
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
            <Link href="/categories" style={{ color: 'inherit', textDecoration: 'none' }}>
              Shop
            </Link>
            <span aria-hidden="true">/</span>
            <span style={{ color: 'var(--mr-fg-2)' }}>Bundles</span>
          </nav>

          <header style={{ marginBottom: 'var(--mr-sp-7)' }}>
            <h1
              style={{
                fontFamily: 'var(--mr-font-serif)',
                fontWeight: 400,
                fontSize: 'clamp(var(--mr-text-2xl), 4vw, var(--mr-text-3xl))',
                lineHeight: 1.08,
                letterSpacing: '-0.006em',
                margin: '0 0 var(--mr-sp-3)',
              }}
            >
              Bundles
            </h1>
            <p style={{ color: 'var(--mr-fg-3)', maxWidth: '60ch', margin: 0 }}>
              Pieces chosen to go together, priced as one.
            </p>
          </header>

          {bundles.length === 0 ? (
            <p style={{ color: 'var(--mr-fg-4)' }}>
              There are no bundles at the moment.
            </p>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 'var(--mr-sp-5)',
              }}
            >
              {bundles.map((bundle) => (
                <Link
                  key={bundle.id}
                  href={`/bundles/${bundle.slug}`}
                  style={{ display: 'block', textDecoration: 'none', color: 'inherit', minWidth: 0 }}
                >
                  <div
                    style={{
                      aspectRatio: '1 / 1',
                      background: 'var(--mr-bg-2, #f4f1ec)',
                      borderRadius: 6,
                      overflow: 'hidden',
                      marginBottom: 'var(--mr-sp-3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {bundle.imageUrl ? (
                      // Never a bare <img>: a replaced set photo lands on a new
                      // uuid-suffixed key whose first request is a guaranteed
                      // cold miss, and one transient failure would leave this
                      // tile broken for every shopper.
                      <UploadPreviewImage
                        src={bundle.imageUrl}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    ) : (
                      <Icon name="grid" size={28} color="var(--mr-fg-4)" />
                    )}
                  </div>
                  <h2
                    style={{
                      fontFamily: 'var(--mr-font-serif)',
                      fontWeight: 400,
                      fontSize: 'var(--mr-text-base)',
                      margin: '0 0 var(--mr-sp-1)',
                    }}
                  >
                    {bundle.name}
                  </h2>
                  <p
                    style={{
                      fontFamily: 'var(--mr-font-ui)',
                      fontSize: 'var(--mr-text-sm)',
                      color: 'var(--mr-fg-2)',
                      margin: 0,
                    }}
                  >
                    {minorToAmount(bundle.priceMinor)} {bundle.currency}
                  </p>
                  {bundle.savingMinor > 0 && (
                    <p
                      style={{
                        fontFamily: 'var(--mr-font-ui)',
                        fontSize: 'var(--mr-text-xs)',
                        color: 'var(--mr-fg-4)',
                        margin: 'var(--mr-sp-1) 0 0',
                      }}
                    >
                      Instead of {minorToAmount(bundle.listTotalMinor)} {bundle.currency} separately
                    </p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
      <FooterWithSettings />
    </>
  );
}
