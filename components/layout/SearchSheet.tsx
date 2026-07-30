'use client';

/**
 * SearchSheet — full-viewport search, as a sheet that drops in from above the
 * top edge rather than a route change.
 *
 * Why a sheet and not a page: search is a lookup, not a destination. Pushing
 * /search threw away the shopper's scroll position and made "changed my mind"
 * cost a back navigation. The sheet keeps the page underneath alive.
 *
 * Why /search still exists and still matters: every path OUT of this sheet is a
 * real <a href="/search?q=…">, and pressing Enter navigates there for real. That
 * URL is canonical, indexable, and listed in the sitemap, so a Google result for
 * "minirue <product>" can land straight on MiniRue's own results page for that
 * term — which is the whole point of keeping a crawlable query URL alongside an
 * instant client-side sheet. The sheet is the fast path; /search is the SEO path.
 *
 * Motion matches the mobile nav sheet, mirrored: translateY(-100%) -> 0 on
 * cubic-bezier(0.7, 0, 0.2, 1) over 600ms, with contents staggered in behind it.
 */

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import IconButton from '@/components/ui/IconButton';
import PriceDisplay from '@/components/storefront/PriceDisplay';
import { catalog, mediaImageUrl, primaryMedia, lowestPrice, productByline } from '@/lib/api/catalog';
import type { ApiProduct } from '@/lib/api/catalog';
import { searchCanonicalPath } from '@/lib/search/query';
import { useSheetDrag } from '@/lib/hooks/useSheetDrag';
import { track } from '@/lib/analytics';

const DEBOUNCE_MS = 220;
const PREVIEW_LIMIT = 6;
const RECENT_KEY = 'mr:recent-searches';
const RECENT_MAX = 5;
// Shared with MobileNavSheet and MobileSheet — see lib/motion/sheet.ts.
import { SHEET_EASE, ITEM_TRANSITION } from '@/lib/motion/sheet';

/** Always the canonical form, so an internal link never points at a URL the
 *  destination page disowns via its own canonical tag. */
export function searchHref(term: string): string {
  return searchCanonicalPath(term);
}

function readRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function rememberRecent(term: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = term.trim();
  if (!trimmed) return;
  try {
    const next = [trimmed, ...readRecent().filter((r) => r.toLowerCase() !== trimmed.toLowerCase())]
      .slice(0, RECENT_MAX);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Private mode / quota — recent searches are a convenience, never a blocker.
  }
}

interface SearchSheetProps {
  open: boolean;
  onClose: () => void;
  /** Menu labels double as the suggestion chips — they are what this shop
   *  actually sells, chosen by the admin, so no invented "popular" terms. */
  suggestions?: string[];
}

export default function SearchSheet({ open, onClose, suggestions = [] }: SearchSheetProps) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const requestId = React.useRef(0);
  const sheetRef = React.useRef<HTMLDivElement>(null);
  // Dismissed by pushing UP, because that is the edge it came from. A sheet
  // that arrives from the top and leaves through the bottom is two different
  // objects as far as the hand is concerned.
  const drag = useSheetDrag({
    direction: 'up',
    enabled: open,
    onDismiss: onClose,
    sheetRef,
  });

  const [term, setTerm] = React.useState('');
  // Results are stored WITH the term that produced them. Keying the payload
  // this way means a response for an older term can never be mistaken for the
  // current one — "is this stale?" becomes a comparison instead of a race, and
  // the loading state is derived rather than tracked as a third flag.
  const [payload, setPayload] = React.useState<{
    term: string;
    items: ApiProduct[];
    total: number;
  } | null>(null);
  const [failedTerm, setFailedTerm] = React.useState<string | null>(null);
  const [recent, setRecent] = React.useState<string[]>([]);

  // Recent terms are re-read each time the sheet opens, adjusted during render
  // rather than in an effect so the list is right on the first painted frame.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setRecent(readRecent());
  }

  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 380);
    return () => clearTimeout(t);
  }, [open]);

  // Clear only once the sheet is fully gone — resetting on the way out would
  // blank the contents mid-slide.
  React.useEffect(() => {
    if (open) return;
    const t = setTimeout(() => {
      setTerm('');
      setPayload(null);
      setFailedTerm(null);
    }, 600);
    return () => clearTimeout(t);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  React.useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Debounced live preview. A rising request id drops responses that arrive out
  // of order; the term stored on the payload keeps the rendered list honest even
  // if one slips through.
  React.useEffect(() => {
    const q = term.trim();
    if (!open || q.length < 2) return;
    const id = ++requestId.current;
    const timer = setTimeout(() => {
      catalog
        .search(q)
        .then((res) => {
          if (id !== requestId.current) return;
          setPayload({ term: q, items: res.data.slice(0, PREVIEW_LIMIT), total: res.meta.total });
          // One event per settled query, not per keystroke — the debounce
          // above (and the stale-response guard) already collapse a typed
          // query down to a single completed search.
          track('search', { q, results: res.meta.total });
          if (res.meta.total === 0) {
            track('search_zero_results', { q });
          }
        })
        .catch(() => {
          if (id !== requestId.current) return;
          setFailedTerm(q);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term, open]);

  const submit = (value: string) => {
    const q = value.trim();
    if (!q) return;
    rememberRecent(q);
    onClose();
    router.push(searchHref(q));
  };

  const q = term.trim();
  const showResults = q.length >= 2;
  const fresh = payload?.term === q ? payload : null;
  const failed = failedTerm === q;
  // "Searching" is not a flag anyone sets — it is simply the state of having a
  // query with neither an answer nor a failure for it yet.
  const searching = showResults && !fresh && !failed;
  const results = fresh?.items ?? [];
  const total = fresh?.total ?? 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 120,
        pointerEvents: open ? 'auto' : 'none',
      }}
    >
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(11,11,11,0.5)',
          // `none`, not `blur(0)`: a backdrop-filter of any value keeps a live
          // compositing layer sampling everything behind it. This wrapper is
          // z-index 120 — above the site header at 50 — so that layer covered
          // the whole page, navbar included, on every route.
          backdropFilter: open ? 'blur(4px)' : 'none',
          WebkitBackdropFilter: open ? 'blur(4px)' : 'none',
          visibility: open ? 'visible' : 'hidden',
          opacity: open ? 1 - drag.progress : 0,
          transition: drag.dragging
            ? 'none'
            : `opacity 400ms var(--mr-ease-snappy), backdrop-filter 400ms ease, visibility 0s linear ${open ? 0 : 400}ms`,
        }}
      />

      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        data-trace-id="PG-STOREFRONT-CAT-004::EL-REGION-search-sheet"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '100dvh',
          background: 'var(--mr-cream-100)',
          boxShadow: '0 18px 48px rgba(11,11,11,0.24)',
          transform: open
            ? `translateY(${-Math.max(drag.offset, 0)}px)`
            : 'translateY(-100%)',
          // A closed sheet is HIDDEN, not merely parked above the fold.
          //
          // This is a full-height panel sitting immediately ABOVE the viewport,
          // and its box-shadow is offset 18px DOWNWARD with a 48px blur — so
          // the shadow of an invisible panel spilled onto the top of the screen.
          // The wrapper is z-index 120, above the header at 50, so it landed
          // over the navbar. It showed up only after scrolling because that is
          // when the mobile URL bar collapses, changing the height of the
          // `position: fixed` wrapper this is anchored to and nudging the
          // parked panel down into view.
          //
          // Exactly the same mechanic as the bottom nav being revealed by
          // overscroll, mirrored to the top of the screen.
          visibility: open ? 'visible' : 'hidden',
          transition: drag.dragging
            ? 'none'
            : `transform 600ms ${SHEET_EASE}, visibility 0s linear ${open ? 0 : 600}ms`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Query bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(term);
          }}
          role="search"
          style={{
            flex: '0 0 auto',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: 'max(18px, env(safe-area-inset-top)) clamp(16px, 4vw, 48px) 18px',
            borderBottom: '1px solid var(--mr-hairline)',
          }}
        >
          <span style={{ color: 'var(--mr-fg-4)', display: 'inline-flex' }}>
            <Icon name="search" size={22} />
          </span>
          <input
            ref={inputRef}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder="Search MiniRue…"
            aria-label="Search products"
            data-trace-id="PG-STOREFRONT-CAT-004::EL-INPUT-search-sheet-query"
            style={{
              flex: 1,
              minWidth: 0,
              background: 'none',
              border: 0,
              outline: 'none',
              padding: '10px 0',
              fontFamily: 'var(--mr-font-serif)',
              fontSize: 'clamp(22px, 5vw, 32px)',
              color: 'var(--mr-fg)',
            }}
          />
          {term && (
            <button
              type="button"
              onClick={() => {
                setTerm('');
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              style={{
                background: 'none',
                border: 0,
                cursor: 'pointer',
                color: 'var(--mr-fg-4)',
                fontFamily: 'var(--mr-font-label)',
                fontSize: 11,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
              }}
            >
              Clear
            </button>
          )}
          <IconButton icon="close" size={40} tone="cream" label="Close search" onClick={onClose} />
        </form>

        {/* Body */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            padding: 'clamp(16px, 4vw, 32px) clamp(16px, 4vw, 48px) 40px',
          }}
        >
          <div style={{ maxWidth: 860, margin: '0 auto' }}>
            {!showResults && (
              <>
                {recent.length > 0 && (
                  <Section title="Recent" revealed={open} index={0}>
                    <TermChips terms={recent} onPick={submit} />
                  </Section>
                )}
                {suggestions.length > 0 && (
                  <Section title="Browse" revealed={open} index={recent.length > 0 ? 1 : 0}>
                    <TermChips terms={suggestions} onPick={submit} />
                  </Section>
                )}
                <p
                  style={{
                    fontFamily: 'var(--mr-font-ui)',
                    fontSize: 'var(--mr-text-sm)',
                    color: 'var(--mr-fg-4)',
                    marginTop: 28,
                  }}
                >
                  Type at least two letters to see products.
                </p>
              </>
            )}

            {showResults && (
              <>
                <p
                  aria-live="polite"
                  style={{
                    fontFamily: 'var(--mr-font-label)',
                    fontSize: 'var(--mr-text-xs)',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    color: 'var(--mr-fg-4)',
                    margin: '0 0 16px',
                  }}
                >
                  {failed
                    ? 'Search is unavailable right now.'
                    : searching
                      ? 'Searching…'
                      : total === 0
                        ? `No matches for “${q}”`
                        : `${total} result${total === 1 ? '' : 's'}`}
                </p>

                {results.map((product, i) => (
                  <SearchRow key={product.id} product={product} index={i} term={q} onNavigate={onClose} />
                ))}

                {total > 0 && (
                  <Link
                    href={searchHref(q)}
                    onClick={() => {
                      rememberRecent(q);
                      onClose();
                    }}
                    data-trace-id="PG-STOREFRONT-CAT-004::EL-LINK-search-sheet-see-all"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 10,
                      marginTop: 24,
                      padding: '16px 20px',
                      borderRadius: 'var(--mr-radius-pill)',
                      background: 'var(--mr-ink-900)',
                      color: 'var(--mr-cream-100)',
                      textDecoration: 'none',
                      fontFamily: 'var(--mr-font-label)',
                      fontSize: 12,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                    }}
                  >
                    See all {total} results for “{q}”
                    <span className="mr-link-arrow">→</span>
                  </Link>
                )}

                {!searching && !failed && total === 0 && (
                  <Link
                    href="/products"
                    onClick={onClose}
                    style={{
                      display: 'inline-block',
                      marginTop: 8,
                      fontFamily: 'var(--mr-font-label)',
                      fontSize: 'var(--mr-text-xs)',
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                      color: 'var(--mr-fg)',
                      borderBottom: '1px solid var(--mr-border)',
                      paddingBottom: 4,
                      textDecoration: 'none',
                    }}
                  >
                    Browse everything <span className="mr-link-arrow">→</span>
                  </Link>
                )}
              </>
            )}
          </div>
        </div>

        {/* Drag handle. On the sheet's bottom edge, not its top: that is the
            free edge of a panel hanging from the top of the screen, and it is
            the only edge a thumb can reach on a full-height sheet. Push it up
            to send the sheet back where it came from. */}
        <div
          {...drag.handleProps}
          role="button"
          tabIndex={-1}
          aria-label="Drag up to close search"
          style={{
            flex: '0 0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px 0 calc(12px + env(safe-area-inset-bottom))',
            borderTop: '1px solid var(--mr-hairline)',
            background: 'var(--mr-cream-200)',
            ...drag.handleProps.style,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 48,
              height: 4,
              borderRadius: 2,
              background: 'var(--mr-cream-400)',
            }}
          />
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  revealed,
  index,
}: {
  title: string;
  children: React.ReactNode;
  revealed: boolean;
  index: number;
}) {
  return (
    <div
      style={{
        marginBottom: 28,
        opacity: revealed ? 1 : 0,
        transform: revealed ? 'translateY(0)' : 'translateY(20px)',
        transition: ITEM_TRANSITION,
        transitionDelay: revealed ? `${300 + index * 100}ms` : '0ms',
      }}
    >
      <p
        style={{
          margin: '0 0 12px',
          fontFamily: 'var(--mr-font-label)',
          fontSize: 'var(--mr-text-xs)',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--mr-fg-4)',
        }}
      >
        {title}
      </p>
      {children}
    </div>
  );
}

/** Real links, not buttons — a crawler following these finds the indexable
 *  /search?q= URLs, and a shopper middle-clicking gets a new tab. */
function TermChips({ terms, onPick }: { terms: string[]; onPick: (t: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      {terms.map((t) => (
        <Link
          key={t}
          href={searchHref(t)}
          onClick={(e) => {
            // Plain click stays in the sheet's fast path; modified clicks keep
            // the browser's own new-tab / new-window behaviour.
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            onPick(t);
          }}
          data-trace-id={`PG-STOREFRONT-CAT-004::EL-LINK-search-suggestion@${t}`}
          style={{
            padding: '10px 16px',
            borderRadius: 'var(--mr-radius-pill)',
            border: '1px solid var(--mr-hairline)',
            background: 'var(--mr-cream-200)',
            color: 'var(--mr-fg)',
            textDecoration: 'none',
            fontFamily: 'var(--mr-font-ui)',
            fontSize: 'var(--mr-text-sm)',
          }}
        >
          {t}
        </Link>
      ))}
    </div>
  );
}

function SearchRow({
  product,
  index,
  term,
  onNavigate,
}: {
  product: ApiProduct;
  index: number;
  /** The query that produced this result — carried on `search_result_click`. */
  term: string;
  onNavigate: () => void;
}) {
  const media = primaryMedia(product);
  const price = lowestPrice(product);
  const src = media ? mediaImageUrl(media, { w: 240, h: 300 }) : null;
  const byline = productByline(product) || product.categoryName || '';

  return (
    <Link
      href={`/products/${product.slug}`}
      onClick={() => {
        track('search_result_click', { q: term, productId: product.id, position: index });
        onNavigate();
      }}
      data-trace-id={`PG-STOREFRONT-CAT-004::EL-LINK-search-result@${product.slug}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '12px 0',
        borderBottom: '1px solid var(--mr-hairline)',
        textDecoration: 'none',
        color: 'inherit',
        animation: `mr-fade-up 380ms var(--mr-ease-out) ${index * 45}ms both`,
      }}
    >
      <span
        style={{
          position: 'relative',
          flex: '0 0 auto',
          width: 64,
          height: 80,
          borderRadius: 'var(--mr-radius-md)',
          overflow: 'hidden',
          background: 'var(--mr-cream-300)',
        }}
      >
        {src && (
          <Image
            src={src}
            alt={media?.altText ?? product.name}
            fill
            sizes="64px"
            style={{ objectFit: 'cover' }}
          />
        )}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontFamily: 'var(--mr-font-ui)',
            fontSize: 'var(--mr-text-base)',
            fontWeight: 500,
            color: 'var(--mr-fg)',
          }}
        >
          {product.name}
        </span>
        {byline && (
          <span
            style={{
              display: 'block',
              fontFamily: 'var(--mr-font-ui)',
              fontSize: 'var(--mr-text-xs)',
              color: 'var(--mr-fg-4)',
              marginTop: 2,
            }}
          >
            {byline}
          </span>
        )}
      </span>
      {price && <PriceDisplay amount={price.amount} currency={price.currency} />}
    </Link>
  );
}
