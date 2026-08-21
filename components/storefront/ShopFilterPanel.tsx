'use client';

import React from 'react';
import {
  SORT_OPTIONS,
  activeFilterCount,
  type ShopFilterState,
} from '@/lib/shop/filters';

/**
 * The facets themselves. One component, rendered twice: in the desktop rail
 * and inside the mobile sheet.
 *
 * Shared rather than duplicated because the two are the SAME control at
 * different widths. Two copies drift — a facet gets added to one and not the
 * other — and the phone is where most of this shop is browsed, so the copy
 * that drifts is usually the one that matters.
 *
 * The split of responsibilities the owner set (2026-08-21) is honoured here:
 * sort and price are FIXED IN CODE, because they are the same on every shop
 * and no admin configures them; brands and categories arrive as options,
 * because they are the shop's own data and change as the shop does.
 */

export interface ShopFacetOption {
  id: string;
  name: string;
  /** Rendered as a quiet count beside the name when the API supplies one. */
  count?: number;
}

interface Props {
  state: ShopFilterState;
  onChange: (next: ShopFilterState) => void;
  brands: ShopFacetOption[];
  categories: ShopFacetOption[];
  /** Hidden on a category page, where the category is the page itself. */
  showCategories?: boolean;
}

const groupTitle: React.CSSProperties = {
  fontFamily: 'var(--mr-font-label)',
  fontSize: 'var(--mr-text-xs)',
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color: 'var(--mr-fg-3)',
  margin: '0 0 var(--mr-sp-3)',
};

const rowBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  // 44px is the tap floor; a filter list is a column of small targets and is
  // exactly where that gets forgotten.
  minHeight: 44,
  padding: '0 2px',
  background: 'none',
  border: 0,
  font: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  color: 'var(--mr-fg-2)',
};

/**
 * A radio, drawn rather than native.
 *
 * These are single-select groups and behave exactly like radios, so they are
 * marked up as radios for assistive tech — `role="radio"` with aria-checked —
 * while being drawn to match the shop. Using buttons with no role would leave
 * a screen reader announcing eight unrelated buttons instead of one choice.
 */
function FacetRow({
  label,
  count,
  checked,
  onSelect,
  traceId,
}: {
  label: string;
  count?: number;
  checked: boolean;
  onSelect: () => void;
  traceId?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      data-trace-id={traceId}
      style={{ ...rowBase, color: checked ? 'var(--mr-fg)' : 'var(--mr-fg-2)' }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 15,
          height: 15,
          flex: '0 0 auto',
          borderRadius: '50%',
          border: `1px solid ${checked ? 'var(--mr-fg)' : 'var(--mr-border)'}`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'border-color var(--mr-dur-fast) var(--mr-ease-out)',
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--mr-fg)',
            transform: checked ? 'scale(1)' : 'scale(0)',
            transition: 'transform var(--mr-dur-medium) var(--mr-ease-spring)',
          }}
        />
      </span>
      <span
        style={{
          fontSize: 'var(--mr-text-sm)',
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      {count !== undefined && (
        <span style={{ fontSize: 'var(--mr-text-xs)', color: 'var(--mr-fg-4)' }}>
          {count}
        </span>
      )}
    </button>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 'var(--mr-sp-6)' }}>
      <p style={groupTitle}>{title}</p>
      <div role="radiogroup" aria-label={title}>
        {children}
      </div>
    </div>
  );
}

const priceInput: React.CSSProperties = {
  font: 'inherit',
  fontSize: 16,
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid color-mix(in srgb, var(--mr-fg) 35%, transparent)',
  background: 'var(--mr-bg-raised, #fff)',
  color: 'var(--mr-fg)',
  width: '100%',
  minWidth: 0,
};

export default function ShopFilterPanel({
  state,
  onChange,
  brands,
  categories,
  showCategories = true,
}: Props) {
  const set = (patch: Partial<ShopFilterState>) => onChange({ ...state, ...patch });

  /**
   * Price is typed, so it is held as TEXT while typing and only turned into a
   * filter on blur or Enter.
   *
   * Committing per keystroke would fire a query for "1", then "12", then
   * "120" — three requests, two of them for a number the shopper never meant,
   * and a list that visibly thrashes underneath them.
   */
  const [minDraft, setMinDraft] = React.useState(
    state.priceMin === null ? '' : String(state.priceMin),
  );
  const [maxDraft, setMaxDraft] = React.useState(
    state.priceMax === null ? '' : String(state.priceMax),
  );

  // Re-sync when the URL changes underneath — the back button, or Clear all.
  React.useEffect(() => {
    setMinDraft(state.priceMin === null ? '' : String(state.priceMin));
    setMaxDraft(state.priceMax === null ? '' : String(state.priceMax));
  }, [state.priceMin, state.priceMax]);

  const commitPrice = () => {
    const toNumber = (raw: string): number | null => {
      const trimmed = raw.trim();
      if (!trimmed) return null;
      const n = Number(trimmed);
      return Number.isFinite(n) && n >= 0 ? n : null;
    };
    set({ priceMin: toNumber(minDraft), priceMax: toNumber(maxDraft) });
  };

  return (
    <div>
      <Group title="Sort">
        {SORT_OPTIONS.map((o) => (
          <FacetRow
            key={o.value}
            label={o.label}
            checked={state.sort === o.value}
            onSelect={() => set({ sort: o.value })}
            traceId={`PG-STOREFRONT-CAT-003::EL-TOGGLE-sort@${o.value}`}
          />
        ))}
      </Group>

      {showCategories && categories.length > 0 && (
        <Group title="Category">
          {/* "All" is a real option, not the absence of one. Without it a
              shopper who picks a category has no way back to everything short
              of finding Clear all. */}
          <FacetRow
            label="All categories"
            checked={state.categoryId === null}
            onSelect={() => set({ categoryId: null })}
            traceId="PG-STOREFRONT-CAT-003::EL-TOGGLE-category@all"
          />
          {categories.map((c) => (
            <FacetRow
              key={c.id}
              label={c.name}
              count={c.count}
              checked={state.categoryId === c.id}
              onSelect={() => set({ categoryId: c.id })}
              traceId={`PG-STOREFRONT-CAT-003::EL-TOGGLE-category@${c.id}`}
            />
          ))}
        </Group>
      )}

      {brands.length > 0 && (
        <Group title="Brand">
          <FacetRow
            label="All brands"
            checked={state.brandId === null}
            onSelect={() => set({ brandId: null })}
            traceId="PG-STOREFRONT-CAT-003::EL-TOGGLE-brand@all"
          />
          {brands.map((b) => (
            <FacetRow
              key={b.id}
              label={b.name}
              count={b.count}
              checked={state.brandId === b.id}
              onSelect={() => set({ brandId: b.id })}
              traceId={`PG-STOREFRONT-CAT-003::EL-TOGGLE-brand@${b.id}`}
            />
          ))}
        </Group>
      )}

      <Group title="Price">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            aria-label="Minimum price"
            inputMode="numeric"
            placeholder="Min"
            value={minDraft}
            onChange={(e) => setMinDraft(e.target.value)}
            onBlur={commitPrice}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitPrice();
              }
            }}
            style={priceInput}
            data-trace-id="PG-STOREFRONT-CAT-003::EL-FIELD-price-min"
          />
          <span aria-hidden="true" style={{ color: 'var(--mr-fg-4)' }}>
            –
          </span>
          <input
            aria-label="Maximum price"
            inputMode="numeric"
            placeholder="Max"
            value={maxDraft}
            onChange={(e) => setMaxDraft(e.target.value)}
            onBlur={commitPrice}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitPrice();
              }
            }}
            style={priceInput}
            data-trace-id="PG-STOREFRONT-CAT-003::EL-FIELD-price-max"
          />
        </div>
      </Group>

      {/* Only offered when it would do something. A permanently visible
          "Clear all" on an unfiltered list is a control that does nothing. */}
      {activeFilterCount(state) > 0 && (
        <button
          type="button"
          onClick={() =>
            set({ brandId: null, categoryId: null, priceMin: null, priceMax: null })
          }
          data-trace-id="PG-STOREFRONT-CAT-003::EL-BTN-clear-filters"
          style={{
            ...rowBase,
            minHeight: 40,
            color: 'var(--mr-fg-3)',
            fontFamily: 'var(--mr-font-label)',
            fontSize: 'var(--mr-text-xs)',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            borderTop: '1px solid var(--mr-hairline)',
            paddingTop: 'var(--mr-sp-4)',
          }}
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}
