import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import AnnouncementBarServer from '@/components/layout/AnnouncementBarServer';
import FooterWithSettings from '@/components/layout/FooterWithSettings';
import BreadcrumbSchema, { SHOP_CRUMB } from '@/components/seo/BreadcrumbSchema';
import CollectionSchema from '@/components/seo/CollectionSchema';
import HeaderWrapper from '@/app/shop/HeaderWrapper';
import { categoryPath } from '@/lib/routes';
import { SITE_OG_IMAGE } from '@/lib/seo/page-seo';
import { catalog } from '@/lib/api/catalog';
import CategoryClient from './CategoryClient';
import { CategoryBreadcrumb } from './category-breadcrumb';
import { resolveCategoryPath, getCategoryListing, buildCategoryDescription } from './category-data';

interface PageProps {
  params: Promise<{ category: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category: slug } = await params;
  const path = await resolveCategoryPath(slug);
  const cat = path?.at(-1);
  if (!cat) {
    return {
      title: 'Browse by Category',
      description: 'Browse products by category at MiniRue.',
      alternates: {
        canonical: categoryPath(slug),
      },
    };
  }

  // Deduped with the page body below — one API call serves both. The count
  // and representative brand names come from this fetched result set — there
  // is no productCount field on Category/StorefrontSpace/StorefrontSpaceCategory,
  // so it cannot come from anywhere else.
  const outcome = await getCategoryListing(cat.id);
  const description = buildCategoryDescription(cat.name, outcome);

  return {
    title: cat.name,
    description,
    alternates: {
      canonical: categoryPath(slug),
    },
    // A child route's `openGraph` replaces the root layout's wholesale, so the
    // share image is named here or there is none (#155): the category's own
    // picture, else the site image.
    openGraph: {
      title: `${cat.name} | MiniRue`,
      description,
      images: [cat.imageUrl ? { url: cat.imageUrl, alt: cat.name } : SITE_OG_IMAGE],
    },
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { category: slug } = await params;
  // Opt out of the partially-prerendered shell — see the note in
  // app/shop/[category]/[product]/page.tsx. The resumed tree never matched the stored
  // shell, so React discarded the server HTML and the page rendered blank.
  await connection();


  // Categories are small — await so we can resolve the slug to a real id.
  // NOTE: no HydrationBoundary/dehydrate here. Nothing on this page consumed a
  // prefetched query, but dehydrate() stamps entries with Date.now(), which
  // baked a build-time timestamp into the partially-prerendered shell. The
  // request-time tree then failed to match it ("Couldn't find all resumable
  // slots by key/index during replaying"), so React discarded the server HTML
  // and the page rendered blank behind the root layout's Suspense fallback.

  const path = await resolveCategoryPath(slug);
  if (!path) {
    notFound();
  }
  const category = path.at(-1)!;
  // Every ancestor above the matched category, root-first — the parent chain
  // the breadcrumb renders between "Shop" and the category itself.
  const ancestors = path.slice(0, -1);

  // Already resolved during generateMetadata — React's cache() makes this the
  // same request, not a second one. Schema and grid below both read from this
  // same array, so they can never disagree.
  const outcome = await getCategoryListing(category.id);
  const { products: initialProducts, hasMore: initialHasMore, cursor: initialCursor } = outcome;

  // The brand facet for this category's rail. Settled, not all: losing the
  // filter is a worse page, losing the page is a broken one.
  // Only brands with something in THIS category (frontend#103) — every brand in
  // the shop would offer choices that filter to "Nothing matches".
  const brandResult = await Promise.allSettled([catalog.listBrands(category.id)]);
  const facetBrands =
    brandResult[0].status === 'fulfilled'
      ? brandResult[0].value.map((b) => ({ id: b.id, name: b.name }))
      : [];

  const displayName = category.name;
  // Ancestor crumbs for the JSON-LD schema — the same chain rendered visibly
  // below, expressed as { name, path } for BreadcrumbSchema.
  const schemaAncestors = ancestors.map((a) => ({
    name: a.name,
    path: categoryPath(a.slug).slice(1),
  }));

  return (
    <>
      <BreadcrumbSchema
        trail={[
          SHOP_CRUMB,
          ...schemaAncestors,
          { name: displayName, path: categoryPath(slug).slice(1) },
        ]}
      />
      <CollectionSchema
        name={displayName}
        path={categoryPath(slug)}
        items={{ kind: 'products', products: initialProducts }}
      />
      <div className="mr-page-sheet">
        <AnnouncementBarServer />
        <HeaderWrapper />

        <main
          style={{
            maxWidth: 'var(--mr-content-max)',
            margin: '0 auto',
            padding: 'clamp(24px,3vw,40px) var(--mr-gutter) clamp(48px,8vw,96px)',
          }}
        >
          {/* Breadcrumb — built from the route and the category's own
              ancestry (Home / Shop / <parent...> / <category>), never a fixed
              word. A category named e.g. "Shop" restating the section crumb
              is not guarded against here: that would require a real category
              named "Shop", which is not the duplicate this page ever had. */}
          <CategoryBreadcrumb ancestors={ancestors} displayName={displayName} />

          {/* Page heading */}
          <div
            data-trace-id="PG-STOREFRONT-CAT-001::EL-REGION-category-page-heading"
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
              Category
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
              {displayName}
            </h1>
          </div>

          <CategoryClient
            categoryId={category.id}
            initialProducts={initialProducts}
            initialHasMore={initialHasMore}
            initialCursor={initialCursor}
            brands={facetBrands}
          />
        </main>
      </div>

      {/* The footer band — AFTER the page sheet, which is where it was before
          September and where the DOM should read it: the page first, its
          footer last. It is ordered UNDER the page by `z-index: -1` resolved
          inside `.mr-app-layer` (app/layout.tsx), not by being moved ahead of
          the page in document order the way #48 did. See
          components/layout/Footer.tsx. */}
      <FooterWithSettings />
    </>
  );
}
