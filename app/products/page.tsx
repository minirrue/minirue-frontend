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
 * sequence for the same canonical.
 *
 * No case normalisation is applied to `brand`, and none should be added.
 * Confirmed by reading the backend: the brand-name filter is CASE-SENSITIVE —
 * it matches with a plain Drizzle `eq(brands.name, brand)`, compiling to
 * Postgres `=` on a `varchar(100)` column, with no `citext` type and no
 * case-insensitive collation anywhere in that repo
 * (`apps/minirue-backend/src/catalog/catalog.repository.ts:288`, column at
 * `src/database/schema/catalog.ts:37`). The `gender` filter two lines above
 * it (`catalog.repository.ts:266`) DOES lower-case both sides for its own
 * comparison, so the lack of that on `brand` is a deliberate choice, not an
 * oversight. That filter is also scoped to house brands only
 * (`isNull(brands.collaboratorId)` in the same query), which is why a
 * partner brand sharing a house brand's name is excluded rather than leaking
 * into this listing.
 *
 * Consequence for this file: `?brand=dior` against a brand actually named
 * "Dior" matches zero rows — `200` with `data: []`, `meta.total: 0` — which
 * `generateMetadata` below already sends `noindex`. So `?brand=Dior` and
 * `?brand=dior` cannot both become independently indexable under different
 * canonicals; the duplicate-content scenario that lower-casing here would
 * exist to prevent cannot occur. Do NOT lower-case `brand` "to be safe" —
 * doing so would canonicalise a working `?brand=Dior` URL onto a
 * `?brand=dior` one that returns nothing. */
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

  // ONE indexability decision, reused below for both which copy to render
  // and robots.index — never computed two different ways. `brandName` is
  // read from `outcome.products` (page-limited) while `isIndexableBrandListing`
  // reads `outcome.total` (a separate, unlimited COUNT over the same filter —
  // `catalog.repository.ts`); those two fields are not guaranteed to agree,
  // so requiring both here removes any risk of the two checks disagreeing
  // rather than relying on them happening to agree in practice.
  const indexable = Boolean(brandName) && isIndexableBrandListing(hasFilter, outcome);

  if (!brandName || !indexable) {
    // Filter resolved to nothing we can safely name — an unknown id, zero
    // matches, or an outage. Mirrors `isIndexableSearchPage`
    // (`app/search/search-data.ts`), including its outage rule: a transient
    // backend blip must never publish an empty listing to Google as
    // "MiniRue doesn't carry this brand".
    return {
      ...DEFAULT_METADATA,
      alternates: { canonical },
      robots: { index: false, follow: true },
    };
  }

  const title = `${brandName} — MiniRue`;
  // No category/product-line clause here — MiniRue carries more than
  // perfumes and cosmetics (see BreadcrumbSchema.tsx's note on the hardcoded
  // "Perfumes" crumb removed for the same reason), so this stays true of any
  // brand's listing rather than naming a product line a given brand may not
  // even sell.
  const description = `${outcome.total} product${outcome.total === 1 ? '' : 's'} from ${brandName} at MiniRue, with free worldwide shipping.`;

  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: indexable, follow: true },
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
  const hasFilter = Boolean(brand || brandId);
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

  // Same resolution generateMetadata uses for its title/canonical — read here
  // too so the CollectionPage JSON-LD and the visible <h1> can never disagree
  // with what the canonical actually claims to be. Without this, a brand
  // filter that generateMetadata makes indexable under a brand-scoped
  // canonical still emitted CollectionSchema as "All Products" at "/products"
  // — the JSON-LD claimed the whole catalogue while the canonical said
  // otherwise — and the <h1> below said "All Products" too, so a brand-filtered
  // page carried no brand term anywhere in its visible text.
  //
  // Gated on hasFilter, matching generateMetadata's own `if (!hasFilter)
  // return DEFAULT_METADATA` guard above — brandListingName() just reads
  // outcome.products[0]'s brand and has no idea whether a filter was actually
  // requested, so on the plain unfiltered /products route (where the fetch
  // returns the whole catalogue) an ungated call resolves to whichever
  // product happens to sort first, and the shop's main page renders that
  // brand's name as its own <h1> and CollectionPage name — the same
  // page-vs-markup contradiction this fix exists to remove, pointed the
  // other way.
  const brandName = hasFilter ? brandListingName(outcome) : null;
  const canonicalPath = brandFilterPath(brand, brandId);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <BreadcrumbSchema trail={[SHOP_CRUMB, { name: 'All Products', path: 'products' }]} />
      <CollectionSchema
        name={brandName ?? 'All Products'}
        path={canonicalPath}
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
              {brandName ?? 'All Products'}
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
