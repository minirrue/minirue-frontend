import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import FooterWithSettings from '@/components/layout/FooterWithSettings';
import BreadcrumbSchema, { SHOP_CRUMB } from '@/components/seo/BreadcrumbSchema';
import CollectionSchema from '@/components/seo/CollectionSchema';
import HeaderWrapper from '@/app/products/HeaderWrapper';
import CategoryClient from './CategoryClient';
import { CategoryBreadcrumb } from './category-breadcrumb';
import { resolveCategoryPath, getCategoryListing, buildCategoryDescription } from './category-data';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const path = await resolveCategoryPath(slug);
  const cat = path?.at(-1);
  if (!cat) {
    return {
      title: 'Browse by Category',
      description: 'Browse products by category at MiniRue.',
      alternates: {
        canonical: `/categories/${slug}`,
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
      canonical: `/categories/${slug}`,
    },
    openGraph: {
      title: `${cat.name} | MiniRue`,
      description,
    },
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;
  // Opt out of the partially-prerendered shell — see the note in
  // app/products/[slug]/page.tsx. The resumed tree never matched the stored
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

  const displayName = category.name;
  // Ancestor crumbs for the JSON-LD schema — the same chain rendered visibly
  // below, expressed as { name, path } for BreadcrumbSchema.
  const schemaAncestors = ancestors.map((a) => ({
    name: a.name,
    path: `categories/${a.slug}`,
  }));

  return (
    <>
      <BreadcrumbSchema
        trail={[
          SHOP_CRUMB,
          ...schemaAncestors,
          { name: displayName, path: `categories/${slug}` },
        ]}
      />
      <CollectionSchema
        name={displayName}
        path={`/categories/${slug}`}
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
          />
        </main>
      </div>
      <FooterWithSettings />
    </>
  );
}
