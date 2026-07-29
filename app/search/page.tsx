import type { Metadata } from 'next';
import Link from 'next/link';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { catalog } from '@/lib/api/catalog';
import { getQueryClient } from '@/lib/hooks/query-client';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import FooterWithSettings from '@/components/layout/FooterWithSettings';
import HeaderWrapper from '@/app/products/HeaderWrapper';
import SearchResultsSchema from '@/components/seo/SearchResultsSchema';
import { JsonLd } from '@/components/seo/JsonLd';
import SearchResultsClient from './SearchResultsClient';

const BASE_URL = 'https://minirueshop.com';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { q } = await searchParams;
  const query = first(q).trim();

  if (!query) {
    // The bare /search page has no content of its own — it is a form. Indexing
    // it competes with the query pages that DO answer something, so it stays
    // out of the index while still passing link equity through.
    return {
      title: 'Search — MiniRue',
      description: 'Search MiniRue for perfumes, cosmetics and accessories.',
      alternates: { canonical: '/search' },
      robots: { index: false, follow: true },
    };
  }

  // Brand-first title: the query a shopper typed into Google is usually
  // "<brand> <thing>", so leading with the term and closing with MiniRue is
  // what matches the query text in the SERP.
  const title = `${query} — MiniRue`;
  const description = `Shop ${query} at MiniRue. Original quality perfumes and cosmetics, with free worldwide shipping.`;
  const canonical = `/search?q=${encodeURIComponent(query)}`;

  return {
    title,
    description,
    // Self-referential canonical on the exact query URL. Without it, every
    // /search?q=… variant (different casing, extra params) is a duplicate of
    // every other and Google picks one at random — or none.
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      type: 'website',
      siteName: 'MiniRue',
      title,
      description,
      url: `${BASE_URL}${canonical}`,
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function SearchPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const query = first(sp['q']).trim();

  const queryClient = getQueryClient();

  let initialProducts: import('@/lib/api/catalog').ApiProduct[] = [];
  let initialHasMore = false;
  let initialCursor: string | null = null;

  if (query) {
    try {
      const res = await catalog.search(query);
      initialProducts = res.data;
      initialHasMore = res.meta.hasMore;
      initialCursor = res.meta.cursor;
    } catch {
      // API unavailable — show empty state
    }
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="mr-page-sheet">
        {query && (
          <>
            <JsonLd
              data={{
                '@context': 'https://schema.org',
                '@type': 'BreadcrumbList',
                itemListElement: [
                  { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
                  { '@type': 'ListItem', position: 2, name: 'Search', item: `${BASE_URL}/search` },
                  {
                    '@type': 'ListItem',
                    position: 3,
                    name: query,
                    item: `${BASE_URL}/search?q=${encodeURIComponent(query)}`,
                  },
                ],
              }}
            />
            <SearchResultsSchema query={query} products={initialProducts} />
          </>
        )}
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
            data-trace-id="PG-STOREFRONT-CAT-004::EL-REGION-breadcrumb-navigation"
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
            {query ? (
              <>
                <Link href="/search" style={{ color: 'inherit', textDecoration: 'none' }}>
                  Search
                </Link>
                <span>/</span>
                <span style={{ color: 'var(--mr-fg-2)' }}>{query}</span>
              </>
            ) : (
              <span style={{ color: 'var(--mr-fg-2)' }}>Search</span>
            )}
          </nav>

          {/* Search header. The live result count lives in the client
              component alongside the input — rendering the server's count here
              too would freeze at whatever the ?q= page load returned and
              contradict the list as the shopper keeps typing. */}
          <div
            data-trace-id="PG-STOREFRONT-CAT-004::EL-REGION-search-results-heading"
            style={{ marginBottom: 'var(--mr-sp-6)' }}
          >
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
              {/* The query IS the page's subject — an H1 that just says
                  "Search" describes the form, not the content, and gives a
                  crawler nothing that matches what was searched for. */}
              {query ? <>Results for &ldquo;{query}&rdquo;</> : 'Search'}
            </h1>
          </div>

          <SearchResultsClient
            query={query}
            initialProducts={initialProducts}
            initialHasMore={initialHasMore}
            initialCursor={initialCursor}
          />
        </main>
      </div>
      <FooterWithSettings />
    </HydrationBoundary>
  );
}
