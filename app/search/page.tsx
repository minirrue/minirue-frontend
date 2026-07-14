import type { Metadata } from 'next';
import Link from 'next/link';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { catalog } from '@/lib/api/catalog';
import { getQueryClient } from '@/lib/hooks/query-client';
import Header from '@/components/layout/Header';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import FooterWithSettings from '@/components/layout/FooterWithSettings';
import SearchResultsClient from './SearchResultsClient';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { q } = await searchParams;
  const query = first(q);
  return {
    title: query ? `"${query}" — Search · MiniRue` : 'Search — MiniRue',
    description: query
      ? `Search results for "${query}" at MiniRue.`
      : 'Search for fragrances at MiniRue.',
  };
}

export default async function SearchPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const query = first(sp['q']);

  const queryClient = getQueryClient();

  let initialProducts: import('@/lib/api/catalog').ApiProduct[] = [];
  let initialHasMore = false;
  let initialCursor: string | null = null;
  let initialTotal = 0;

  if (query.trim()) {
    try {
      const res = await catalog.search(query.trim());
      initialProducts = res.data;
      initialHasMore = res.meta.hasMore;
      initialCursor = res.meta.cursor;
      initialTotal = res.meta.total;
    } catch {
      // API unavailable — show empty state
    }
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="mr-page-sheet">
        <AnnouncementBar />
        <Header onOpenCart={() => {}} cartCount={0} transparent={false} />

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
            <span style={{ color: 'var(--mr-fg-2)' }}>Search</span>
          </nav>

          {/* Search header */}
          <div
            data-trace-id="PG-STOREFRONT-CAT-004::EL-REGION-search-results-heading"
            style={{ marginBottom: 'var(--mr-sp-7)' }}
          >
            {query.trim() ? (
              <>
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
                  {initialTotal > 0
                    ? `${initialTotal} result${initialTotal !== 1 ? 's' : ''}`
                    : 'No results'}
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
                  Results for &ldquo;{query}&rdquo;
                </h1>
              </>
            ) : (
              <h1
                style={{
                  fontFamily: 'var(--mr-font-serif)',
                  fontWeight: 400,
                  fontSize: 'clamp(var(--mr-text-2xl), 4vw, var(--mr-text-3xl))',
                  margin: 0,
                  color: 'var(--mr-fg)',
                }}
              >
                Search
              </h1>
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
