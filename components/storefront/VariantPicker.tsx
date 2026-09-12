'use client';

import React from 'react';
import type { ProductVariant } from '@/lib/api/catalog';
import { variantLabel, variantInStock } from '@/lib/api/catalog';
import PriceDisplay from './PriceDisplay';

interface VariantPickerProps {
  variants: ProductVariant[];
  selectedId: string | null;
  onChange: (variant: ProductVariant) => void;
  /** RULEBOOK §27 — data-trace-id PREFIX for each variant toggle, e.g.
   * "PG-STOREFRONT-CAT-005::EL-TOGGLE-variant-option"; the variant id is appended as the
   * repeating-element instance key ("@{variant.id}"). */
  traceIdPrefix?: string;
  /**
   * Which edge the pills line up on. The label above them is ordinary text and
   * simply inherits the caller's `text-align`; the pills are a flex row and
   * cannot, so the caller has to say. Defaults to `left` — the picker was
   * left-aligned everywhere before the product panel was centred (#42), and a
   * default that silently follows the panel would be a surprise anywhere else.
   */
  align?: 'left' | 'center';
}

export default function VariantPicker({ variants, selectedId, onChange, traceIdPrefix, align = 'left' }: VariantPickerProps) {
  const active = variants.filter((v) => v.isActive);

  if (!active.length) return null;

  /**
   * No picker when there is nothing to pick.
   *
   * Every product carries at least one variant — that is where price and stock
   * live — but that is a fact about the DATA MODEL, not a decision the shopper
   * has to make. A product with a single unnamed variant was rendering a
   * heading and one chip, asking someone to choose between one thing, and the
   * chip read "000001" because the label fell back to the SKU (owner,
   * 2026-08-21: "i tried it with no variants, so no variants should be there").
   *
   * The test is whether any variant can describe itself. Two variants that
   * differ only by price still get a picker — the price on each chip is the
   * choice — but a lone nameless one is just the product, and the buy button
   * below already carries its price and its sold-out state.
   */
  const labelled = active.filter((v) => variantLabel(v).length > 0);
  if (active.length < 2 && labelled.length === 0) return null;

  return (
    <div>
      <div
        style={{
          fontFamily: 'var(--mr-font-label)',
          fontSize: 'var(--mr-text-xs)',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          // fg-4 is ~3.5:1 on cream, and this is 12px uppercase text that
          // needs 4.5:1. It is the "ML" above the size pills.
          color: 'var(--mr-fg-3)',
          marginBottom: 'var(--mr-sp-3)',
        }}
      >
        {/* The real dimension names when the variants carry them. "Options"
            when they do not — the old fallback said "Volume", which is a guess
            about what the product IS, on a shop that sells cosmetics as well as
            perfume. A wrong label is worse than a generic one. */}
        {active[0]?.values?.length
          ? active[0].values.map((x) => x.attributeName).join(' / ')
          : 'Options'}
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: align === 'center' ? 'center' : 'flex-start',
          gap: 'var(--mr-sp-2)',
        }}
      >
        {active.map((v) => {
          const isSelected = v.id === selectedId;
          // A sold-out size stays visible but unpickable: hiding it makes the
          // product look like it never had that size, and letting it be picked
          // only moves the refusal to checkout.
          const sellable = variantInStock(v);
          const label = variantLabel(v);
          return (
            <button
              key={v.id}
              data-trace-id={traceIdPrefix ? `${traceIdPrefix}@${v.id}` : undefined}
              onClick={() => sellable && onChange(v)}
              disabled={!sellable}
              aria-pressed={isSelected}
              aria-disabled={!sellable}
              title={sellable ? undefined : 'Out of stock'}
              style={{
                padding: '11px 16px',
                cursor: sellable ? 'pointer' : 'not-allowed',
                // One refusal, not two. Strikethrough plus 40% opacity made the
                // size AND the price unreadable; the words "Sold out" say it
                // once and the pill stays above 4.5:1.
                opacity: sellable ? 1 : 0.72,
                background: isSelected ? 'var(--mr-fg)' : 'transparent',
                color: isSelected ? 'var(--mr-bg-raised)' : 'var(--mr-fg-2)',
                border: `1px ${sellable ? 'solid' : 'dashed'} ${isSelected ? 'var(--mr-fg)' : 'var(--mr-border)'}`,
                borderRadius: 'var(--mr-radius-pill)',
                fontFamily: 'var(--mr-font-label)',
                fontSize: 'var(--mr-text-xs)',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                transform: isSelected ? 'scale(1.03)' : 'scale(1)',
                transition: 'all var(--mr-dur-medium) var(--mr-ease-spring)',
                willChange: 'transform',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {/* An unlabelled variant shows its PRICE and nothing else.
                  "Option 1" was a placeholder for a name that does not exist,
                  and it read as though the shopper were missing information
                  (owner, 2026-08-21: "option 1 remove it, just the price on
                  it, because that's the only field anyway"). When price is the
                  only thing distinguishing two variants, price IS the label —
                  so the separator dot below is dropped too, or the chip opens
                  with a bullet and nothing before it. */}
              {label && <span>{label}</span>}
              {sellable ? (
                <span
                  style={{
                    fontFamily: 'var(--mr-font-serif)',
                    fontWeight: 500,
                    fontSize: 'var(--mr-text-sm)',
                    // A price that IS the label carries full weight; a price
                    // trailing a name stays secondary to it.
                    opacity: label ? 0.75 : 1,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {label ? <>·{' '}</> : null}
                  <PriceDisplay
                    amount={v.priceAmount}
                    currency={v.priceCurrency}
                    style={{ fontSize: 'inherit', fontFamily: 'inherit', color: 'inherit' }}
                  />
                </span>
              ) : (
                // A price you cannot act on is noise. The reason takes its place.
                <span
                  style={{
                    fontFamily: 'var(--mr-font-label)',
                    fontSize: 'var(--mr-text-xs)',
                    letterSpacing: '0.16em',
                    color: 'var(--mr-fg-3)',
                  }}
                >
                  {label ? '· ' : ''}Sold out
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
