import type { Metadata } from 'next';
import Link from 'next/link';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import type { ProductListFilters } from '@/lib/api/catalog';
import { getQueryClient } from '@/lib/hooks/query-client';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import FooterWithSettings from '@/components/layout/FooterWithSettings';
import BreadcrumbSchema, { SHOP_CRUMB } from '@/components/seo/BreadcrumbSchema';
import CollectionSchema from '@/components/seo/CollectionSchema';
import ProductListingClient from './ProductListingClient';
import HeaderWrapper from './HeaderWrapper';
import { getProductListing, isIndexableBrandListing, brandListingName } from './products-data';
import { SITE_URL as BASE_URL } from '@/lib/seo/config';

// This is MiniRue's main shop area — every product regardless of category or
// brand. Nothing about what it sells is fixed to one kind of product, so the
// copy stays neutral rather than naming a category MiniRue may not even carry
// any more.
const DEFAULT_METADATA: Metadata = {
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

/** The one URL a given brand filter is allowed to live at — brandId first,
 * then brand, so the two filters (see the comment below) never collide on
 * the same canonical when somehow both are present. `encodeURIComponent`
 * matches `searchCanonicalPath` (`lib/search/query.ts`) rather than
 * `URLSearchParams`, whose `+`-for-space encoding would be a different byte
 * sequence for the same canonical. */
function brandFilterPath(brand: string, brandId: string): string {
  const parts: string[] = [];
  if (brandId) parts.push(`brandId=${encodeURIComponent(brandId)}`);
  if (brand) parts.push(`brand=${encodeURIComponent(brand)}`);
  return parts.length ? `/products?${parts.join('&')}` : '/products';
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const sp = await searchParams;
  // `brandId` is the scoped filter a house brand tile links with
  // (`/products?brandId=<id>`, Task 7) — `brand` (by name) is legacy, no
  // longer linked to anywhere in this app, and now backend-restricted to
  // house/unowned brands so it can't leak a partner's products into this
  // listing. They are not interchangeable (an id vs. a free-text name
  // matched against a restricted subset), so neither is normalised into the
  // other here — each self-canonicalises to the URL it was actually given,
  // the same way `/search?q=` does.
  const brand = (first(sp['brand']) ?? '').trim();
  const brandId = (first(sp['brandId']) ?? '').trim();
  const hasFilter = Boolean(brand || brandId);

  if (!hasFilter) {
    return DEFAULT_METADATA;
  }

  // Deduped with the page body below — one API call serves both.
  const outcome = await getProductListing(brand, brandId);
  const canonical = brandFilterPath(brand, brandId);

  // The brand name is read only from a resolved product, never from the raw
  // query string — an unknown brandId, a `brand` name with no matches, and an
  // API outage all land here with no name to safely show, so all three fall
  // back to the same neutral shop-wide copy rather than a fabricated one.
  const brandName = brandListingName(outcome);
  if (!brandName) {
    return {
      ...DEFAULT_METADATA,
      alternates: { canonical },
      // Only a page that answers something may be indexed — mirrors
      // `isIndexableSearchPage` (`app/search/search-data.ts`), including its
      // outage rule: a transient backend blip must never publish an empty
      // listing to Google as "MiniRue doesn't carry this brand".
      robots: { index: false, follow: true },
    };
  }

  const title = `${brandName} — MiniRue`;
  const description = `${outcome.total} product${outcome.total === 1 ? '' : 's'} from ${brandName} at MiniRue. Original quality perfumes and cosmetics, with free worldwide shipping.`;

  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: isIndexableBrandListing(hasFilter, outcome), follow: true },
    openGraph: {
      title,
      description,
      url: `${BASE_URL}${canonical}`,
    },
  };
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
  const brand = (first(sp['brand']) ?? '').trim();
  const brandId = (first(sp['brandId']) ?? '').trim();
  const filters: ProductListFilters = {
    brand: brand || undefined,
    brandId: brandId || undefined,
    limit: 24,
  };

  const queryClient = getQueryClient();

  // Already resolved during generateMetadata — React's cache() makes this the
  // same request, not a second one.
  const outcome = await getProductListing(brand, brandId);
  const { products: initialProducts, hasMore: initialHasMore, cursor: initialCursor } = outcome;

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
