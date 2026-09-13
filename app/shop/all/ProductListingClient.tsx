'use client';

import React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { catalog } from '@/lib/api/catalog';
import type { ApiProduct, ProductListFilters } from '@/lib/api/catalog';
import CatalogProductGrid from '@/components/storefront/CatalogProductGrid';
import ShopFilterPanel, {
  type ShopFacetOption,
} from '@/components/storefront/ShopFilterPanel';
import Button from '@/components/ui/Button';
import MobileSheet from '@/components/ui/MobileSheet';
import BrandFilterControl from '@/components/storefront/BrandFilterControl';
import { useBreakpoint } from '@/lib/hooks/useBreakpoint';
import {
  activeFilterCount,
  parseFilters,
  toApiFilters,
  toSearchParams,
  SORT_OPTIONS,
  type ShopFilterState,
} from '@/lib/shop/filters';

interface ProductListingClientProps {
  initialProducts: ApiProduct[];
  initialHasMore: boolean;
  initialCursor: string | null;
  initialFilters: ProductListFilters;
  /** The shop's own brands and categories — the two server-side facets. */
  brands?: ShopFacetOption[];
  categories?: ShopFacetOption[];
  showCategories?: boolean;
  /** Overridden by the category page, which has somewhere better to send an
   *  empty result than "no products available". */
  emptyMessage?: string;
  emptyAction?: React.ReactNode;
}

/**
 * Storefront product listing, with filters and sort.
 *
 * The old hardcoded Gender bar was removed in 2026-07-24 and left a note
 * saying "real filters, driven by actual attributes, will be added later".
 * This is that, built to the split the owner set: sort and price are fixed in
 * code because they are the same on every shop, brands and categories come
 * from the catalogue because they are the shop's own data.
 *
 * STATE LIVES IN THE URL, not in this component. A filtered view is then
 * shareable, survives a reload, and steps backwards through the back button —
 * and the server can render the first page already filtered rather than
 * flashing everything and then narrowing it.
 *
 * The APPLYING is the server's job either way. Filtering a paginated list in
 * the browser would only ever filter the page you happen to be holding, so
 * "under 300 EGP" would quietly mean "under 300 EGP, among these 24" — a
 * filter that lies. See lib/shop/filters.ts.
 */
export default function ProductListingClient({
  initialProducts,
  initialHasMore,
  initialCursor,
  initialFilters,
  brands = [],
  categories = [],
  showCategories = true,
  emptyMessage,
  emptyAction,
}: ProductListingClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { mobile } = useBreakpoint();

  const urlState = React.useMemo(
    () => parseFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  /**
   * The selection a tap produces, shown before the URL agrees.
   *
   * The filters live in the URL (see the note above), which is right — but it
   * meant a tap could not move the radio button until `router.push` had
   * completed a route transition and `searchParams` came back changed. That is
   * a server round trip, and it was measured in seconds: the control sat dead
   * the whole time, so shoppers tapped again and changed the filter twice (#5).
   *
   * `useOptimistic` shows `next` immediately and reverts to the URL's own
   * answer when the transition that set it finishes — by which time the two
   * are the same value, so there is no flash. Crucially it reverts on a FAILED
   * navigation too, so the control can never be left showing a filter that is
   * not applied.
   */
  const [state, showSelectionNow] = React.useOptimistic(urlState);
  const [navigating, startNavigation] = React.useTransition();

  const [products, setProducts] = React.useState<ApiProduct[]>(initialProducts);
  const [hasMore, setHasMore] = React.useState(initialHasMore);
  const [cursor, setCursor] = React.useState<string | null>(initialCursor);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  /**
   * Whatever the page was FIRST rendered with, kept whole.
   *
   * A category page reaches this component with `categoryId` already pinned by
   * the route — that is not a filter the shopper chose and it must survive
   * every change they make. Merging it under the URL-derived filters keeps the
   * page's own scope intact while letting the shopper narrow inside it.
   */
  // useState's initializer, not a ref: the value is captured once and never
  // written, which is exactly what lazy initial state gives — and unlike a ref
  // it is safe to read while rendering, which the memo below does.
  const [baseFilters] = React.useState(initialFilters);

  const apiFilters = React.useMemo(
    () => ({ ...baseFilters, ...toApiFilters(state) }),
    [baseFilters, state],
  );

  /**
   * The refetch keys on this string, not on `apiFilters`.
   *
   * `state` changes identity twice per tap now — once for the optimistic value
   * and once when the URL lands with the same filters — and a memo keyed on an
   * object identity would fire the same request both times. Comparing the
   * VALUE collapses that back to one.
   */
  const filterKey = JSON.stringify(apiFilters);

  /**
   * Refetch when the filters change — but never on the first render.
   *
   * The server already rendered page one with exactly these filters, so
   * fetching them again immediately would replace correct content with
   * identical content, one round trip later, and throw away the scroll
   * position for nothing.
   */
  const isFirst = React.useRef(true);
  React.useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    let cancelled = false;
    setRefreshing(true);
    catalog
      .listProducts({ ...apiFilters, limit: 24 })
      .then((res) => {
        if (cancelled) return;
        setProducts(res.data);
        setHasMore(res.meta.hasMore);
        setCursor(res.meta.cursor);
      })
      .catch(() => {
        // Leave the previous results on screen. A filter that fails should not
        // also empty the page the shopper was reading.
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
    // Keyed on the filters' VALUE, not `apiFilters`' identity — see filterKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  function apply(next: ShopFilterState) {
    const params = toSearchParams(next);
    // Anything the ROUTE put in the URL that is not a facet — `brand`, a
    // partner `space` — is carried across. Rebuilding the query string from
    // the facets alone would silently drop it and widen the listing.
    for (const [key, value] of searchParams.entries()) {
      if (!params.has(key) && !FACET_KEYS.has(key)) params.set(key, value);
    }
    const qs = params.toString();
    const href = qs ? `${pathname}?${qs}` : pathname;
    // Both inside the transition: the optimistic selection is tied to THIS
    // navigation, so it lasts exactly as long as the navigation does and is
    // rolled back with it. `startTransition` is also what keeps `navigating`
    // true for the whole route change, which is what the results dim on.
    //
    // `scroll: false` — changing a filter must not fling the shopper to the
    // top of a list they are part-way down.
    startNavigation(() => {
      showSelectionNow(next);
      router.push(href, { scroll: false });
    });
  }

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      // The FILTERS go with the cursor. They did not, so page two came back
      // unfiltered and appended somebody else's products underneath a filtered
      // page one — invisible until you scrolled far enough to hit it.
      const res = await catalog.listProducts({ ...apiFilters, cursor, limit: 24 });
      setProducts((prev) => [...prev, ...res.data]);
      setHasMore(res.meta.hasMore);
      setCursor(res.meta.cursor);
    } catch {
      // silent — user can retry
    } finally {
      setLoadingMore(false);
    }
  };

  /**
   * Busy is the RESULTS, never the control.
   *
   * Two things can be in flight: the route change carrying the new filters in
   * the URL, and this component's own refetch. Either one means the grid below
   * is out of date, and neither should stop the filter above from responding
   * to the next tap.
   */
  const busy = refreshing || navigating;

  const count = activeFilterCount(state);
  const sortLabel =
    SORT_OPTIONS.find((o) => o.value === state.sort)?.label ?? 'Featured';

  const panel = (
    <ShopFilterPanel
      state={state}
      onChange={apply}
      brands={brands}
      categories={categories}
      showCategories={showCategories}
    />
  );

  const hasFacets = brands.length > 0 || (showCategories && categories.length > 0);
  const showBrandControl = brands.length >= 2;

  return (
    <div
      style={{
        display: 'grid',
        // minmax(0, 1fr), never a bare 1fr — a bare one is minmax(auto, 1fr)
        // and refuses to shrink below its content, which is what ran the whole
        // cart and checkout flow off the right edge of a phone.
        gridTemplateColumns:
          mobile || !hasFacets ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) 232px',
        gap: 'var(--mr-sp-7)',
        alignItems: 'start',
      }}
    >
      <div style={{ minWidth: 0, order: 1 }}>
        {/* The mobile control bar. On desktop the rail is always visible, so
            a button to reveal it would open something already open. */}
        {/* The toolbar. Filter & sort only on a phone (on desktop the rail is
            always open); Brand on every width, beside it (frontend#103). */}
        {((mobile && hasFacets) || showBrandControl) && (
          <div
            data-trace-id="PG-STOREFRONT-CAT-003::EL-REGION-listing-toolbar"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 'var(--mr-sp-3)',
              marginBottom: 'var(--mr-sp-5)',
            }}
          >
            {mobile && hasFacets && (
            <Button
              variant="outline"
              onClick={() => setSheetOpen(true)}
              traceId="PG-STOREFRONT-CAT-003::EL-BTN-open-filters"
            >
              Filter &amp; sort
              {count > 0 && (
                <span
                  // The count is the whole reason this badge exists: a shopper
                  // returning to a filtered list needs to know it is filtered
                  // before they wonder where half the shop went.
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 18,
                    height: 18,
                    padding: '0 5px',
                    borderRadius: 9,
                    background: 'var(--mr-fg)',
                    color: 'var(--mr-bg-raised)',
                    fontSize: 11,
                    letterSpacing: 0,
                    verticalAlign: 'middle',
                  }}
                >
                  {count}
                </span>
              )}
            </Button>
            )}
            <BrandFilterControl
              brands={brands}
              brandId={state.brandId}
              onSelect={(brandId) => apply({ ...state, brandId })}
            />
            {mobile && (
            <span
              style={{
                marginLeft: 'auto',
                fontFamily: 'var(--mr-font-ui)',
                fontSize: 'var(--mr-text-xs)',
                color: 'var(--mr-fg-4)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {sortLabel}
            </span>
            )}
          </div>
        )}

        <div
          // Dimmed, not replaced by a spinner. Keeping the old results in
          // place means the page does not collapse and reflow on every filter
          // change, and the shopper can still see what they had.
          style={{
            opacity: busy ? 0.55 : 1,
            transition: 'opacity var(--mr-dur-fast) var(--mr-ease-out)',
          }}
          aria-busy={busy || undefined}
        >
          <CatalogProductGrid
            products={products}
            hasMore={hasMore}
            onLoadMore={loadMore}
            loadingMore={loadingMore}
            listTraceId="PG-STOREFRONT-CAT-003::EL-LIST-product-listing-grid"
            cardTraceIdPrefix="PG-STOREFRONT-CAT-003::EL-CARD-product-card"
            loadMoreTraceId="PG-STOREFRONT-CAT-003::EL-BTN-load-more-products"
            /**
             * A filtered empty list and an empty shop are different problems
             * and must not share a sentence. "No products available yet" under
             * an active filter reads as "this shop is empty", when the shop is
             * fine and the filter is simply too narrow.
             */
            emptyMessage={
              count > 0
                ? 'Nothing matches those filters yet'
                : (emptyMessage ?? 'No products available yet')
            }
            emptyAction={count > 0 ? undefined : emptyAction}
          />
        </div>
      </div>

      {!mobile && hasFacets && (
        <aside
          aria-label="Filter and sort"
          data-trace-id="PG-STOREFRONT-CAT-003::EL-REGION-filter-rail"
          style={{
            order: 2,
            minWidth: 0,
            // Sticks while the grid scrolls past. Nothing above this in the
            // tree may use `overflow: hidden` — that creates a scroll
            // container and kills position:sticky in descendants silently.
            position: 'sticky',
            top: 96,
          }}
        >
          {panel}
        </aside>
      )}

      {mobile && (
        <MobileSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="Filter & sort"
          traceId="PG-STOREFRONT-CAT-003::EL-SHEET-filters"
        >
          {panel}
        </MobileSheet>
      )}
    </div>
  );
}

/**
 * The params this component owns.
 *
 * Anything NOT in here belongs to the route (`brand`, `space`) and is carried
 * across untouched when a facet changes — see `apply`.
 */
const FACET_KEYS = new Set([
  'sort',
  'brandId',
  'categoryId',
  'priceMin',
  'priceMax',
]);
