'use client';

/**
 * CartItemRow — one line in the bag, as a customer reads it.
 *
 * It renders a `BagLine`, not a cart API row. For an ordinary product the two
 * are the same thing; for a set, one line stands for every member row the
 * server is holding (see bag-lines.ts). That is the whole of #56: the bag used
 * to render rows, so a two-piece set arrived as two separately removable
 * half-sets — each labelled with a raw variant UUID, because the cart API
 * carries no display copy.
 *
 * Displays: photo, name, meta (brand · size · bottle, or the set's contents),
 * one qty stepper, unit price, line total, remove. Shows a loading overlay
 * during a write.
 */

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { BagLine } from './bag-lines';
import PriceDisplay from '@/components/storefront/PriceDisplay';

// Flat policy cap. Never the whole ceiling by itself — `line.maxQty` already
// folds in real stock, and for a set, how many units of each member it takes.
const POLICY_MAX = 10;

interface CartItemRowProps {
  line: BagLine;
  onUpdateQty: (line: BagLine, qty: number) => Promise<void>;
  onRemove: (line: BagLine) => Promise<void>;
}

export default function CartItemRow({ line, onUpdateQty, onRemove }: CartItemRowProps) {
  const [busy, setBusy] = React.useState(false);

  const isSet = line.kind === 'bundle';
  const effectiveMax = Math.max(1, Math.min(POLICY_MAX, line.maxQty));
  /**
   * Only a real scarcity signal. `maxQty >= 10` means the flat cap is the
   * reason for the ceiling, not stock, and "Only 10 left" when there are 400
   * is a lie. For a set the number counts SETS, which is the only unit the
   * shopper can act on here.
   */
  const scarceNote = line.scarce
    ? isSet
      ? `Only ${effectiveMax} ${effectiveMax === 1 ? 'set' : 'sets'} left`
      : `Only ${effectiveMax} left`
    : null;

  async function handleQty(delta: number) {
    const next = line.qty + delta;
    if (next < 1 || next > effectiveMax) return;
    setBusy(true);
    try {
      await onUpdateQty(line, next);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setBusy(true);
    try {
      await onRemove(line);
    } finally {
      setBusy(false);
    }
  }

  const imgSrc = line.imageUrl
    ? line.imageUrl
    : line.cloudinaryPublicId
      ? `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/w_160,h_200,c_fill,q_auto,f_auto/${line.cloudinaryPublicId}`
      : null;

  const nameNode = line.href ? (
    <Link
      href={line.href}
      style={{ color: 'inherit', textDecoration: 'none' }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none';
      }}
    >
      {line.name}
    </Link>
  ) : (
    line.name
  );

  return (
    <div
      data-line-kind={line.kind}
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

      {/* Photo — the set's own, for a set. The dashboard's bundle form has a
          dedicated PHOTO field precisely so a set is not represented by one of
          its members. */}
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
            alt={line.altText}
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
            {line.name}
          </div>
        )}
      </div>

      {/* Details */}
      <div
        style={{
          flex: 1,
          /**
           * `minWidth: 0` is load-bearing, not tidiness.
           *
           * A flex item defaults to `min-width: auto`, which refuses to shrink
           * below its content's intrinsic minimum. A long product name —
           * "Eilish Intense Eau de Parfum" — therefore pushed this column wider
           * than the space available, and the whole row overflowed its
           * container: on a phone the line items ran past the right edge while
           * the order-summary card below them sat correctly inset, which is
           * what "the screen looks cut out on the right side" was (owner,
           * 2026-08-21, /cart at 390px).
           *
           * Fixed here rather than left to `overflow-x: clip` on the root. That
           * rule exists for the chat button, which hangs off the edge BY
           * DESIGN; using it to hide real content would turn an overflowing
           * row into a silently truncated one, which is worse than a scrollbar.
           */
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--mr-sp-2)',
        }}
      >
        {/* Name */}
        <div
          style={{
            fontFamily: 'var(--mr-font-ui)',
            fontSize: 'var(--mr-text-base)',
            fontWeight: 500,
            color: 'var(--mr-fg)',
            lineHeight: 1.3,
            // The other half of minWidth:0 above — the column may now shrink,
            // so the name has to be allowed to wrap inside it rather than
            // sitting on one unbreakable line.
            overflowWrap: 'anywhere',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--mr-sp-2)',
            flexWrap: 'wrap',
          }}
        >
          {nameNode}
          {isSet && (
            /* Says why this line cannot be taken apart, and why no code will
               touch it — both rules the bundle page already states. */
            <span
              style={{
                fontFamily: 'var(--mr-font-label)',
                fontSize: 10,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--mr-gold-500)',
                border: '1px solid var(--mr-hairline)',
                borderRadius: 'var(--mr-radius-pill)',
                padding: '2px 8px',
                whiteSpace: 'nowrap',
              }}
            >
              Set
            </span>
          )}
        </div>

        {/* Meta: brand · size · bottle_type, or what is in the set */}
        {line.meta && (
          <div
            style={{
              fontFamily: 'var(--mr-font-ui)',
              fontSize: 'var(--mr-text-xs)',
              color: 'var(--mr-fg-4)',
              letterSpacing: '0.02em',
              overflowWrap: 'anywhere',
            }}
          >
            {line.meta}
          </div>
        )}

        {/* Qty selector — ONE for the whole set. Stepping it writes
            qty × unitsPerSet to every member row, so a set at 2 reserves 2 of
            each component rather than one line of one. */}
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
            disabled={busy || line.qty <= 1}
            onClick={() => void handleQty(-1)}
            style={qtyBtnStyle(busy || line.qty <= 1)}
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
            {line.qty}
          </span>
          <button
            aria-label="Increase quantity"
            disabled={busy || line.qty >= effectiveMax}
            onClick={() => void handleQty(1)}
            style={qtyBtnStyle(busy || line.qty >= effectiveMax)}
          >
            +
          </button>
        </div>

        {/* Scarcity note — only a real signal, never shown for a policy-only
            ceiling. Also covers the case where stock dropped below the qty
            already in the bag: we show the note and let the shopper reduce it
            rather than silently mutating their cart. */}
        {scarceNote && (
          <div
            style={{
              fontFamily: 'var(--mr-font-ui)',
              fontSize: 'var(--mr-text-xs)',
              color: 'var(--mr-fg-4)',
            }}
          >
            {scarceNote}
          </div>
        )}

        {/* Prices */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 'var(--mr-sp-3)',
            marginTop: 'var(--mr-sp-1)',
          }}
        >
          {/* Unit price — for a set, the set's own price, never the sum of the
              parts bought separately. */}
          <PriceDisplay
            amount={line.unitPriceAmount}
            currency={line.currency}
            style={{ fontSize: 'var(--mr-text-sm)', color: 'var(--mr-fg-3)' }}
          />
          {line.qty > 1 && (
            <>
              <span
                style={{
                  fontFamily: 'var(--mr-font-ui)',
                  fontSize: 'var(--mr-text-xs)',
                  color: 'var(--mr-fg-4)',
                }}
              >
                ×{line.qty}
              </span>
              {/* Line total */}
              <PriceDisplay
                amount={line.lineTotalAmount}
                currency={line.currency}
                style={{ fontSize: 'var(--mr-text-md)', color: 'var(--mr-fg)' }}
              />
            </>
          )}
        </div>
      </div>

      {/* Remove — the whole set, never one member of it. */}
      <button
        aria-label={`Remove ${line.name} from cart`}
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
