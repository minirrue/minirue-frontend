'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { catalog } from '@/lib/api/catalog';
import type { ApiProduct } from '@/lib/api/catalog';
import CatalogProductGrid from '@/components/storefront/CatalogProductGrid';
import Icon from '@/components/ui/Icon';

interface SearchResultsClientProps {
  query: string;
  initialProducts: ApiProduct[];
  initialHasMore: boolean;
  initialCursor: string | null;
}

const DEBOUNCE_MS = 250;
const TRACE = 'PG-STOREFRONT-CAT-004';

/**
 * Live search.
 *
 * The page used to render results for ?q= and nothing else — there was no input
 * anywhere, while the empty state told shoppers to "enter a search term above"
 * and the header's search icon pushed to /search with no query. So search was
 * unreachable unless you hand-wrote the URL.
 *
 * The field lives here now and queries as you type (debounced), seeded by the
 * server-rendered results so a shared /search?q=… link still renders complete
 * HTML for crawlers. The URL is kept in sync with replace() so the address bar
 * and back button stay honest without re-running the server page per keystroke.
 */
export default function SearchResultsClient({
  query,
  initialProducts,
  initialHasMore,
  initialCursor,
}: SearchResultsClientProps) {
  const router = useRouter();

  const [term, setTerm] = React.useState(query);
  const [products, setProducts] = React.useState<ApiProduct[]>(initialProducts);
  const [hasMore, setHasMore] = React.useState(initialHasMore);
  const [cursor, setCursor] = React.useState<string | null>(initialCursor);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [searching, setSearching] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /** The term the current `products` belong to, so we never show a stale list. */
  const settledTerm = React.useRef(query);
  /** Rising id: only the newest request may commit its results. */
  const requestId = React.useRef(0);

  const runSearch = React.useCallback(async (raw: string) => {
    const q = raw.trim();
    const id = ++requestId.current;

    if (!q) {
      settledTerm.current = '';
      setProducts([]);
      setHasMore(false);
      setCursor(null);
      setSearching(false);
      setError(null);
      return;
    }

    setSearching(true);
    setError(null);
    try {
      const res = await catalog.search(q);
      // A slower earlier request must never overwrite a newer one's results.
      if (id !== requestId.current) return;
      settledTerm.current = q;
      setProducts(res.data);
      setHasMore(res.meta.hasMore);
      setCursor(res.meta.cursor);
    } catch {
      if (id !== requestId.current) return;
      setError('Search is unavailable right now. Please try again.');
      setProducts([]);
      setHasMore(false);
      setCursor(null);
    } finally {
      if (id === requestId.current) setSearching(false);
    }
  }, []);

  // Debounced querying + URL sync. Skips the initial render for the term the
  // server already resolved, so landing on /search?q=oud does not refetch it.
  React.useEffect(() => {
    if (term.trim() === settledTerm.current.trim()) return;

    const handle = window.setTimeout(() => {
      void runSearch(term);
      const q = term.trim();
      // replace(), not push(): typing should not fill the back stack with a
      // history entry per keystroke.
      router.replace(q ? `/search?q=${encodeURIComponent(q)}` : '/search', {
        scroll: false,
      });
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(handle);
  }, [term, runSearch, router]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await catalog.search(settledTerm.current, cursor);
      setProducts((prev) => [...prev, ...res.data]);
      setHasMore(res.meta.hasMore);
      setCursor(res.meta.cursor);
    } catch {
      // Leave what is already on screen; the button stays available to retry.
    } finally {
      setLoadingMore(false);
    }
  };

  const searchField = (
    <div style={{ marginBottom: 'var(--mr-sp-6)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--mr-sp-3)',
          borderBottom: '1px solid var(--mr-border)',
          paddingBottom: 'var(--mr-sp-3)',
        }}
      >
        <Icon name="search" size={18} />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search perfumes, brands…"
          aria-label="Search products"
          autoFocus
          data-trace-id={`${TRACE}::EL-INPUT-search-query`}
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: 'var(--mr-font-serif)',
            fontSize: 'clamp(20px, 3vw, 30px)',
            color: 'var(--mr-fg)',
          }}
        />
        {term && (
          <button
            type="button"
            onClick={() => setTerm('')}
            aria-label="Clear search"
            data-trace-id={`${TRACE}::EL-BTN-clear-search`}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--mr-fg-4)',
              display: 'inline-flex',
            }}
          >
            <Icon name="close" size={16} />
          </button>
        )}
      </div>
      <div
        aria-live="polite"
        style={{
          marginTop: 'var(--mr-sp-2)',
          minHeight: 18,
          fontFamily: 'var(--mr-font-label)',
          fontSize: 'var(--mr-text-xs)',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--mr-fg-4)',
        }}
      >
        {searching
          ? 'Searching…'
          : settledTerm.current.trim()
            ? `${products.length} result${products.length === 1 ? '' : 's'}`
            : ''}
      </div>
    </div>
  );

  if (error) {
    return (
      <>
        {searchField}
        <p className="mr-inline-error" style={{ color: 'var(--mr-crimson-500)' }}>
          {error}
        </p>
      </>
    );
  }

  if (!settledTerm.current.trim() && !searching) {
    return (
      <>
        {searchField}
        <div
          data-trace-id={`${TRACE}::EL-REGION-empty-search-prompt`}
          style={{
            textAlign: 'center',
            padding: 'var(--mr-sp-9) 0',
            color: 'var(--mr-fg-3)',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--mr-font-serif)',
              fontStyle: 'italic',
              fontSize: 'var(--mr-text-xl)',
              margin: '0 0 var(--mr-sp-5)',
            }}
          >
            Start typing to find a fragrance.
          </p>
          <Link
            href="/products"
            data-trace-id={`${TRACE}::EL-LINK-browse-all-perfumes-from-search`}
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
            Browse all perfumes →
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      {searchField}
      <CatalogProductGrid
        products={products}
        hasMore={hasMore}
        onLoadMore={loadMore}
        loadingMore={loadingMore}
        listTraceId={`${TRACE}::EL-LIST-search-results-grid`}
        cardTraceIdPrefix={`${TRACE}::EL-CARD-product-card`}
        loadMoreTraceId={`${TRACE}::EL-BTN-load-more-search-results`}
        emptyMessage={
          searching ? 'Searching…' : `Nothing matches “${settledTerm.current.trim()}”`
        }
        emptyAction={
          <button
            type="button"
            data-trace-id={`${TRACE}::EL-BTN-reset-search`}
            onClick={() => setTerm('')}
            style={{
              fontFamily: 'var(--mr-font-label)',
              fontSize: 'var(--mr-text-xs)',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--mr-fg)',
              borderBottom: '1px solid var(--mr-gold-400)',
              paddingBottom: 2,
            }}
          >
            Clear search
          </button>
        }
      />
    </>
  );
}
