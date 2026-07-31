import type { Metadata } from 'next';
import Link from 'next/link';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/hooks/query-client';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import FooterWithSettings from '@/components/layout/FooterWithSettings';
import HeaderWrapper from '@/app/products/HeaderWrapper';
import SearchResultsSchema from '@/components/seo/SearchResultsSchema';
import { JsonLd } from '@/components/seo/JsonLd';
import { normalizeSearchTerm, searchCanonicalPath } from '@/lib/search/query';
import { getSearchResults, isIndexableSearchPage } from './search-data';
import SearchResultsClient from './SearchResultsClient';
import { SITE_URL as BASE_URL } from '@/lib/seo/config';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { q } = await searchParams;
  const raw = first(q);
  const term = normalizeSearchTerm(raw);

  if (!term) {
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

  // Deduped with the page body below — one API call serves both.
  const outcome = await getSearchResults(term);
  const indexable = isIndexableSearchPage(term, outcome);

  // Term-first title: the phrase a shopper typed into Google is what has to
  // match the SERP line, so it leads and the brand closes.
  const title = `${term} — MiniRue`;
  const description = indexable
    ? `${outcome.total} product${outcome.total === 1 ? '' : 's'} matching “${term}” at MiniRue. Original quality perfumes and cosmetics, with free worldwide shipping.`
    : `Search results for “${term}” at MiniRue.`;
  // Canonical is built from the NORMALISED term, not the one in the address
  // bar. ?q=Dior and ?q=dior therefore both point at ?q=dior — one page
  // collecting the signals instead of two splitting them.
  const canonical = searchCanonicalPath(term);

  return {
    title,
    description,
    alternates: { canonical },
    // Only a page that answers something may be indexed. A junk term, a term
    // with no matches, and a backend outage all land here as noindex — the
    // outage case especially, since publishing "no results" during a blip
    // tells Google this shop does not stock what it stocks. `follow` stays on
    // so the product links on the page are still crawled either way.
    robots: { index: indexable, follow: true },
    openGraph: {
      type: 'website',
      siteName: 'MiniRue',
      title,
      description,
      url: `${BASE_URL}${canonical}`,
      // Named explicitly: a child route's `openGraph` replaces the root
      // layout's wholesale, so omitting this silently ships search links with
      // no share image at all.
      images: [{ url: `${BASE_URL}/og-image.jpg`, width: 1200, height: 630, alt: 'MiniRue' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${BASE_URL}/og-image.jpg`],
    },
  };
}

export default async function SearchPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  // The normalised term is what the page renders, links to and describes, so
  // the visible page and the canonical URL can never disagree.
  const query = normalizeSearchTerm(first(sp['q']));

  const queryClient = getQueryClient();

  // Already resolved during generateMetadata — React's cache() makes this the
  // same request, not a second one.
  const outcome = await getSearchResults(query);
  const { products: initialProducts, total, hasMore: initialHasMore, cursor: initialCursor } = outcome;

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
                    item: `${BASE_URL}${searchCanonicalPath(query)}`,
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
            {/* Server-rendered, so the count is in the HTML a crawler reads.
                The live count next to the input is the client's job and drifts
                as the shopper keeps typing; this one describes the URL. */}
            {query && outcome.ok && (
              <p
                style={{
                  margin: 'var(--mr-sp-3) 0 0',
                  fontFamily: 'var(--mr-font-ui)',
                  fontSize: 'var(--mr-text-sm)',
                  color: 'var(--mr-fg-3)',
                }}
              >
                {total === 0
                  ? `No products match “${query}” at MiniRue right now.`
                  : `${total} product${total === 1 ? '' : 's'} matching “${query}” at MiniRue.`}
              </p>
            )}
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
