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
}

export default function VariantPicker({ variants, selectedId, onChange, traceIdPrefix }: VariantPickerProps) {
  const active = variants.filter((v) => v.isActive);

  if (!active.length) return null;

  return (
    <div>
      <div
        style={{
          fontFamily: 'var(--mr-font-label)',
          fontSize: 'var(--mr-text-xs)',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--mr-fg-4)',
          marginBottom: 'var(--mr-sp-3)',
        }}
      >
        {active[0]?.values?.length
          ? active[0].values.map((x) => x.attributeName).join(' / ')
          : 'Volume'}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--mr-sp-2)' }}>
        {active.map((v) => {
          const isSelected = v.id === selectedId;
          // A sold-out size stays visible but unpickable: hiding it makes the
          // product look like it never had that size, and letting it be picked
          // only moves the refusal to checkout.
          const sellable = variantInStock(v);
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
                opacity: sellable ? 1 : 0.4,
                textDecoration: sellable ? 'none' : 'line-through',
                background: isSelected ? 'var(--mr-fg)' : 'transparent',
                color: isSelected ? 'var(--mr-bg-raised)' : 'var(--mr-fg-2)',
                border: `1px solid ${isSelected ? 'var(--mr-fg)' : 'var(--mr-border)'}`,
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
              <span>{variantLabel(v)}</span>
              <span
                style={{
                  fontFamily: 'var(--mr-font-serif)',
                  fontWeight: 500,
                  fontSize: 'var(--mr-text-sm)',
                  opacity: 0.75,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                ·{' '}
                <PriceDisplay
                  amount={v.priceAmount}
                  currency={v.priceCurrency}
                  style={{ fontSize: 'inherit', fontFamily: 'inherit', color: 'inherit' }}
                />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
