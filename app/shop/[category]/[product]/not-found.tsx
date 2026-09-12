import Link from 'next/link';
import HeaderWrapper from '@/app/shop/HeaderWrapper';
import AnnouncementBarServer from '@/components/layout/AnnouncementBarServer';
import FooterWithSettings from '@/components/layout/FooterWithSettings';

export default function ProductNotFound() {
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
            padding: 'clamp(80px,12vw,140px) var(--mr-gutter)',
            textAlign: 'center',
          }}
        >
          <h1
            style={{
              fontFamily: 'var(--mr-font-serif)',
              fontWeight: 400,
              fontSize: 'clamp(var(--mr-text-xl), 3vw, var(--mr-text-2xl))',
              lineHeight: 1.15,
              margin: '0 0 var(--mr-sp-5)',
              color: 'var(--mr-fg)',
              textWrap: 'balance',
            }}
          >
            Product not found
          </h1>
          <p
            style={{
              fontFamily: 'var(--mr-font-body)',
              fontSize: 'var(--mr-text-base)',
              color: 'var(--mr-fg-2)',
              margin: '0 0 var(--mr-sp-7)',
              maxWidth: '42ch',
              marginInline: 'auto',
            }}
          >
            This fragrance may have been removed or the link is no longer valid.
          </p>
          <Link
            href="/shop/all"
            style={{
              fontFamily: 'var(--mr-font-label)',
              fontSize: 'var(--mr-text-xs)',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--mr-fg)',
              borderBottom: '1px solid var(--mr-gold-400)',
              paddingBottom: 2,
              textDecoration: 'none',
            }}
          >
            Back to catalog
          </Link>
        </main>
      </div>
    </>
  );
}
