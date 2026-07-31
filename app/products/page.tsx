import type { Metadata } from 'next';
import Link from 'next/link';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { catalog } from '@/lib/api/catalog';
import type { ProductListFilters } from '@/lib/api/catalog';
import { getQueryClient } from '@/lib/hooks/query-client';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import FooterWithSettings from '@/components/layout/FooterWithSettings';
import BreadcrumbSchema, { SHOP_CRUMB } from '@/components/seo/BreadcrumbSchema';
import CollectionSchema from '@/components/seo/CollectionSchema';
import ProductListingClient from './ProductListingClient';
import HeaderWrapper from './HeaderWrapper';

// This is MiniRue's main shop area — every product regardless of category or
// brand. Nothing about what it sells is fixed to one kind of product, so the
// copy stays neutral rather than naming a category MiniRue may not even carry
// any more.
export const metadata: Metadata = {
  title: 'All Products',
  description: 'Browse the full MiniRue collection.',
  alternates: {
    canonical: '/products',
  },
  openGraph: {
    title: 'All Products | MiniRue',
    description: 'Browse the full MiniRue collection.',
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

  // Gender filtering was removed (2026-07-24) — it was a hardcoded concept and
  // product attributes are admin-managed/free-entry now. `brand` stays because
  // it is a real, dynamic value; real attribute-driven filters come later.
  // `brandId` is the scoped filter a house brand tile links with
  // (`/products?brandId=<id>`, Task 7) — `brand` (by name) is legacy and now
  // backend-restricted to house/unowned brands so it can't leak a partner's
  // products into this listing.
  const filters: ProductListFilters = {
    brand: first(sp['brand']),
    brandId: first(sp['brandId']),
    limit: 24,
  };

  const queryClient = getQueryClient();

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
    <HydrationBoundary state={dehydrate(queryClient)}>
      <BreadcrumbSchema trail={[SHOP_CRUMB, { name: 'All Products', path: 'products' }]} />
      <CollectionSchema
        name="All Products"
        path="/products"
        items={{ kind: 'products', products: initialProducts }}
      />
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
          {/* Breadcrumb — /products IS the shop's top level, so "Shop" is the
              current (non-link) crumb rather than a category name. */}
          <nav
            aria-label="Breadcrumb"
            data-trace-id="PG-STOREFRONT-CAT-003::EL-REGION-breadcrumb-navigation"
            style={{
              fontFamily: 'var(--mr-font-label)',
              fontSize: 'var(--mr-text-xs)',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--mr-fg-4)',
              marginBottom: 'var(--mr-sp-6)',
            }}
          >
            <ol
              style={{
                display: 'flex',
                gap: 'var(--mr-sp-2)',
                alignItems: 'center',
                listStyle: 'none',
                margin: 0,
                padding: 0,
              }}
            >
              <li>
                <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
                  Home
                </Link>
              </li>
              <span aria-hidden="true">/</span>
              <li>
                <span style={{ color: 'var(--mr-fg-2)' }}>Shop</span>
              </li>
            </ol>
          </nav>

          {/* Page heading */}
          <div
            data-trace-id="PG-STOREFRONT-CAT-003::EL-REGION-collection-page-heading"
            style={{ marginBottom: 'var(--mr-sp-7)' }}
          >
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
              All Products
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
    </HydrationBoundary>
  );
}
