import type { Metadata } from 'next';
import { connection } from 'next/server';
import Link from 'next/link';
import AnnouncementBarServer from '@/components/layout/AnnouncementBarServer';
import FooterWithSettings from '@/components/layout/FooterWithSettings';
import HeaderWrapper from '@/app/shop/HeaderWrapper';
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
      {/* Curtain layer — BEFORE the sheet on purpose: both are positioned with
          `z-index: auto`, so document order alone decides which paints on top.
          See components/layout/Footer.tsx. */}
      <FooterWithSettings />

      <div className="mr-page-sheet">
        <AnnouncementBarServer />
        <HeaderWrapper />
        <main
          style={{
            maxWidth: 'var(--mr-content-max)',
            margin: '0 auto',
            padding: 'clamp(24px,3vw,40px) var(--mr-gutter) clamp(48px,8vw,96px)',
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
            <Link href="/shop" style={{ color: 'inherit', textDecoration: 'none' }}>
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
                      // `fill` below is absolutely positioned and needs a
                      // positioned ancestor, as any `next/image fill` does.
                      position: 'relative',
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
                        fill
                        /*
                          Geometry: `<main>` is max 1280px of content inside
                          `var(--mr-gutter)` = clamp(20px, 4vw, 48px); the grid
                          is `auto-fill, minmax(220px, 1fr)` with a 24px gap
                          (`--mr-sp-5`), so the column count is
                          floor((row + 24) / 244) and the card is
                          (row − 24·(n−1)) / n.

                            390px viewport → gutter 20 → row 350 → 1 column → 350px
                           1440px viewport → gutter 48 → row 1280 → 5 columns → 237px

                          A card is widest just before a column is added, at
                          220 + 244/n — 464px at one column, 342px at two,
                          301px at three. Each stop is the upper bound of its
                          band, so nothing is ever fetched narrower than it
                          renders.
                        */
                        sizes="(max-width: 500px) calc(100vw - 40px), (max-width: 520px) 92vw, (max-width: 1035px) 50vw, (max-width: 1376px) 33vw, 240px"
                        style={{ objectFit: 'cover' }}
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
    </>
  );
}
