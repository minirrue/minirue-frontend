import type { Metadata } from 'next';
import Link from 'next/link';
import { catalog } from '@/lib/api/catalog';
import type { ProductListFilters } from '@/lib/api/catalog';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import FooterWithSettings from '@/components/layout/FooterWithSettings';
import BreadcrumbSchema from '@/components/seo/BreadcrumbSchema';
import ProductListingClient from './ProductListingClient';
import HeaderWrapper from './HeaderWrapper';

export const metadata: Metadata = {
  title: 'All Perfumes',
  description: 'Browse the full MiniRue collection of original-quality fragrances.',
  alternates: {
    canonical: '/products',
  },
  openGraph: {
    title: 'All Perfumes | MiniRue',
    description: 'Browse the full MiniRue collection of original-quality fragrances.',
  },
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function ProductsPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  const filters: ProductListFilters = {
    gender: first(sp['gender']) as ProductListFilters['gender'],
    brand: first(sp['brand']),
    limit: 24,
  };

  let initialProducts: import('@/lib/api/catalog').ApiProduct[] = [];
  let initialHasMore = false;
  let initialCursor: string | null = null;

  try {
    const res = await catalog.listProducts(filters);
    initialProducts = res.data;
    initialHasMore = res.meta.hasMore;
    initialCursor = res.meta.cursor;
  } catch {
    // API unavailable — render empty state, client will not load more
  }

  return (
    <>
      <BreadcrumbSchema productName="All Perfumes" productSlug="products" />
      <div className="mr-page-sheet">
        <AnnouncementBar />
        <HeaderWrapper />

        <main
          style={{
            maxWidth: 'var(--mr-content-max)',
            margin: '0 auto',
            padding: 'clamp(48px,8vw,96px) var(--mr-gutter)',
          }}
        >
          {/* Breadcrumb */}
          <nav
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
            <span>/</span>
            <span style={{ color: 'var(--mr-fg-2)' }}>Perfumes</span>
          </nav>

          {/* Page heading */}
          <div style={{ marginBottom: 'var(--mr-sp-7)' }}>
            <div
              style={{
                fontFamily: 'var(--mr-font-label)',
                fontSize: 'var(--mr-text-xs)',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'var(--mr-fg-3)',
                marginBottom: 'var(--mr-sp-3)',
              }}
            >
              The collection
            </div>
            <h1
              style={{
                fontFamily: 'var(--mr-font-serif)',
                fontWeight: 400,
                fontSize: 'clamp(var(--mr-text-2xl), 4vw, var(--mr-text-3xl))',
                lineHeight: 1.08,
                letterSpacing: '-0.006em',
                margin: 0,
                color: 'var(--mr-fg)',
              }}
            >
              All Perfumes
            </h1>
          </div>

          <ProductListingClient
            initialProducts={initialProducts}
            initialHasMore={initialHasMore}
            initialCursor={initialCursor}
            initialFilters={filters}
          />
        </main>
      </div>
      <FooterWithSettings />
    </>
  );
}
