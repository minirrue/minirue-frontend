'use client';

import React from 'react';
import Button from '@/components/ui/Button';
import { FacetRow, type ShopFacetOption } from './ShopFilterPanel';

const POPOVER_WIDTH = 280;
const EDGE = 16;

/** px to shift the list from the button's left edge so it fits the viewport. */
export function popoverOffset(buttonLeft: number, viewportWidth: number): number {
  const width = Math.min(POPOVER_WIDTH, viewportWidth - 2 * EDGE);
  const overflowRight = buttonLeft + width - (viewportWidth - EDGE);
  const shift = overflowRight > 0 ? -overflowRight : 0;
  // Never past the left edge either.
  return Math.max(shift, EDGE - buttonLeft);
}

interface Props {
  brands: ShopFacetOption[];
  /** The applied brand, from the listing's filter state. */
  brandId: string | null;
  onSelect: (brandId: string | null) => void;
}

/**
 * The Brand filter in the listing toolbar, beside Filter & sort (frontend#103).
 *
 * Owner, 2026-09-13: filter any category by brand "beside the current sort and
 * filter". The brand radios in the filter panel stay; this reads and writes the
 * same `brandId`, so the two can never disagree. One brand is not a choice, so
 * it renders nothing below two.
 */
export default function BrandFilterControl({ brands, brandId, onSelect }: Props) {
  const [open, setOpen] = React.useState(false);
  // Horizontal offset of the list from the button, clamped so the list stays
  // 16px inside the screen on both sides. On a phone the Brand button sits
  // right of Filter & sort, and a 280px list hung from its left edge ran off
  // the screen (measured on production at 390px wide).
  const [offsetX, setOffsetX] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const listId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (brands.length < 2) return null;

  const active = brands.find((b) => b.id === brandId) ?? null;
  const choose = (id: string | null) => {
    setOpen(false);
    onSelect(id);
  };

  return (
    <div ref={rootRef} style={{ position: 'relative', minWidth: 0 }}>
      <Button
        variant={active ? 'primary' : 'outline'}
        onClick={() => {
          const rect = rootRef.current?.getBoundingClientRect();
          if (rect) setOffsetX(popoverOffset(rect.left, window.innerWidth));
          setOpen((v) => !v);
        }}
        traceId="PG-STOREFRONT-CAT-003::EL-BTN-open-brand"
        ariaLabel={active ? `Brand: ${active.name}. Change brand` : 'Filter by brand'}
        style={{ maxWidth: '100%' }}
      >
        <span
          style={{
            display: 'inline-block',
            maxWidth: 180,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            verticalAlign: 'bottom',
          }}
        >
          {active ? `Brand: ${active.name}` : 'Brand'}
        </span>
        <span aria-hidden="true">
          {open ? '▴' : '▾'}
        </span>
      </Button>

      {open && (
        <div
          id={listId}
          role="radiogroup"
          aria-label="Brand"
          data-trace-id="PG-STOREFRONT-CAT-003::EL-POPOVER-brand"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: offsetX,
            zIndex: 30,
            width: `min(${POPOVER_WIDTH}px, calc(100vw - 2 * var(--mr-gutter)))`,
            maxHeight: 320,
            overflowY: 'auto',
            padding: 'var(--mr-sp-3)',
            background: 'var(--mr-bg-raised)',
            border: '1px solid var(--mr-hairline)',
            borderRadius: 'var(--mr-radius-lg)',
            boxShadow: 'var(--mr-shadow-md)',
          }}
          data-lenis-prevent
        >
          <FacetRow
            label="All brands"
            checked={brandId === null}
            onSelect={() => choose(null)}
            traceId="PG-STOREFRONT-CAT-003::EL-TOGGLE-toolbar-brand@all"
          />
          {brands.map((b) => (
            <FacetRow
              key={b.id}
              label={b.name}
              checked={brandId === b.id}
              onSelect={() => choose(b.id)}
              traceId={`PG-STOREFRONT-CAT-003::EL-TOGGLE-toolbar-brand@${b.id}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
