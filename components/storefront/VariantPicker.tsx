'use client';

import React from 'react';
import type { ProductVariant } from '@/lib/api/catalog';
import PriceDisplay from './PriceDisplay';

interface VariantPickerProps {
  variants: ProductVariant[];
  selectedId: string | null;
  onChange: (variant: ProductVariant) => void;
}

export default function VariantPicker({ variants, selectedId, onChange }: VariantPickerProps) {
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
        Volume
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--mr-sp-2)' }}>
        {active.map((v) => {
          const isSelected = v.id === selectedId;
          return (
            <button
              key={v.id}
              onClick={() => onChange(v)}
              aria-pressed={isSelected}
              style={{
                padding: '11px 16px',
                cursor: 'pointer',
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
              <span>{v.sizeMl}ml</span>
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
