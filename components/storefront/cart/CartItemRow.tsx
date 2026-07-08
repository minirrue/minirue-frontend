'use client';

/**
 * CartItemRow — a single line item in the cart.
 *
 * Displays: product image (Cloudinary), name, brand, size_ml, bottle_type,
 * qty selector (−/+, capped at 10), unit price, line total, remove button.
 * Shows a loading overlay during qty update.
 */

import React from 'react';
import Image from 'next/image';
import type { CartItem } from './CartContext';
import PriceDisplay from '@/components/storefront/PriceDisplay';

const QTY_MAX = 10;

interface CartItemRowProps {
  item: CartItem;
  onUpdateQty: (itemId: string, qty: number) => Promise<void>;
  onRemove: (itemId: string) => Promise<void>;
}

export default function CartItemRow({ item, onUpdateQty, onRemove }: CartItemRowProps) {
  const [busy, setBusy] = React.useState(false);

  async function handleQty(delta: number) {
    const next = item.qty + delta;
    if (next < 1 || next > QTY_MAX) return;
    setBusy(true);
    try {
      await onUpdateQty(item.id, next);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setBusy(true);
    try {
      await onRemove(item.id);
    } finally {
      setBusy(false);
    }
  }

  const imgSrc = item.imageUrl
    ? item.imageUrl
    : item.cloudinaryPublicId
      ? `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/w_160,h_200,c_fill,q_auto,f_auto/${item.cloudinaryPublicId}`
      : null;

  const meta = [item.brand, item.sizeMl ? `${item.sizeMl} ml` : null, item.bottleType]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--mr-sp-4)',
        padding: 'var(--mr-sp-5) 0',
        borderBottom: '1px solid var(--mr-hairline)',
        position: 'relative',
        opacity: busy ? 0.6 : 1,
        transition: 'opacity var(--mr-dur-fast) var(--mr-ease-out)',
      }}
    >
      {/* Loading overlay — prevents double-clicks */}
      {busy && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            cursor: 'wait',
          }}
        />
      )}

      {/* Product image */}
      <div
        style={{
          width: 76,
          height: 96,
          flexShrink: 0,
          background: 'var(--mr-cream-300)',
          borderRadius: 'var(--mr-radius-md)',
          boxShadow: 'var(--mr-shadow-sm)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {imgSrc ? (
          <Image
            src={imgSrc}
            alt={item.altText ?? item.name ?? 'Product'}
            fill
            sizes="76px"
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <div
            aria-hidden
            style={{
              inset: 0,
              position: 'absolute',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--mr-fg-4)',
              fontFamily: 'var(--mr-font-serif)',
              fontStyle: 'italic',
              fontSize: 'var(--mr-text-xs)',
              textAlign: 'center',
              padding: 'var(--mr-sp-2)',
            }}
          >
            {item.name ?? '—'}
          </div>
        )}
      </div>

      {/* Details */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--mr-sp-2)' }}>
        {/* Name */}
        <div
          style={{
            fontFamily: 'var(--mr-font-ui)',
            fontSize: 'var(--mr-text-base)',
            fontWeight: 500,
            color: 'var(--mr-fg)',
            lineHeight: 1.3,
          }}
        >
          {item.name ?? `Variant #${item.variantId}`}
        </div>

        {/* Meta: brand · size · bottle_type */}
        {meta && (
          <div
            style={{
              fontFamily: 'var(--mr-font-ui)',
              fontSize: 'var(--mr-text-xs)',
              color: 'var(--mr-fg-4)',
              letterSpacing: '0.02em',
            }}
          >
            {meta}
          </div>
        )}

        {/* Qty selector */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--mr-sp-2)',
            marginTop: 'var(--mr-sp-1)',
          }}
        >
          <button
            aria-label="Decrease quantity"
            disabled={busy || item.qty <= 1}
            onClick={() => void handleQty(-1)}
            style={qtyBtnStyle(busy || item.qty <= 1)}
          >
            −
          </button>
          <span
            className="mr-num"
            style={{
              fontFamily: 'var(--mr-font-ui)',
              fontSize: 'var(--mr-text-sm)',
              color: 'var(--mr-fg)',
              minWidth: 20,
              textAlign: 'center',
            }}
          >
            {item.qty}
          </span>
          <button
            aria-label="Increase quantity"
            disabled={busy || item.qty >= QTY_MAX}
            onClick={() => void handleQty(1)}
            style={qtyBtnStyle(busy || item.qty >= QTY_MAX)}
          >
            +
          </button>
        </div>

        {/* Prices */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 'var(--mr-sp-3)',
            marginTop: 'var(--mr-sp-1)',
          }}
        >
          {/* Unit price */}
          <PriceDisplay
            amount={item.unitPriceAmount}
            currency={item.unitPriceCurrency}
            style={{ fontSize: 'var(--mr-text-sm)', color: 'var(--mr-fg-3)' }}
          />
          {item.qty > 1 && (
            <>
              <span
                style={{
                  fontFamily: 'var(--mr-font-ui)',
                  fontSize: 'var(--mr-text-xs)',
                  color: 'var(--mr-fg-4)',
                }}
              >
                ×{item.qty}
              </span>
              {/* Line total */}
              <PriceDisplay
                amount={item.lineTotalAmount}
                currency={item.unitPriceCurrency}
                style={{ fontSize: 'var(--mr-text-md)', color: 'var(--mr-fg)' }}
              />
            </>
          )}
        </div>
      </div>

      {/* Remove button */}
      <button
        aria-label={`Remove ${item.name ?? 'item'} from cart`}
        disabled={busy}
        onClick={() => void handleRemove()}
        style={{
          background: 'none',
          border: 'none',
          cursor: busy ? 'wait' : 'pointer',
          color: 'var(--mr-fg-4)',
          fontSize: 18,
          lineHeight: 1,
          padding: 'var(--mr-sp-1)',
          alignSelf: 'flex-start',
          transition: 'color var(--mr-dur-fast) var(--mr-ease-out)',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--mr-danger)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--mr-fg-4)';
        }}
      >
        ×
      </button>
    </div>
  );
}

function qtyBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--mr-cream-300)',
    border: '1px solid var(--mr-border)',
    borderRadius: 'var(--mr-radius-sm)',
    fontFamily: 'var(--mr-font-ui)',
    fontSize: 'var(--mr-text-base)',
    color: disabled ? 'var(--mr-fg-4)' : 'var(--mr-fg)',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    transition: 'opacity var(--mr-dur-fast) var(--mr-ease-out)',
    lineHeight: 1,
    userSelect: 'none',
  };
}
