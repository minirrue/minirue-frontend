'use client';

import React from 'react';
import {
  type DiscountPreview,
  loadAppliedCode,
  previewDiscount,
  saveAppliedCode,
} from '@/lib/api/discounts';
import { track } from '@/lib/analytics/track';

/**
 * Where a shopper types `MINIRUE-K7P2X4`.
 *
 * Lives on the Bag and Payment steps — apply early, or remember at the last
 * moment. Not on Confirmation, which is a receipt with nothing to type into,
 * and not on Delivery, which is about an address; both of those show the
 * applied code as a summary line instead.
 *
 * Quiet by design. MiniRue's product rules put "loud discount e-commerce" —
 * red badges, urgency banners — on the list of things this shop is not. So this
 * is one field and one line of result, with no exclamation marks.
 */

export interface DiscountLine {
  variantId: string;
  qty: number;
  unitPriceMinor: number;
}

export function DiscountCodeField({
  lines,
  onChange,
  compact = false,
}: {
  lines: DiscountLine[];
  /** Fires whenever the saving changes, including on removal (0). */
  onChange?: (preview: DiscountPreview | null) => void;
  compact?: boolean;
}) {
  const [input, setInput] = React.useState('');
  const [applied, setApplied] = React.useState<DiscountPreview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  });

  /**
   * The bag as a stable string.
   *
   * The effect below must re-price when the bag genuinely changes and stay put
   * otherwise. `lines` is a fresh array on every render of the parent, so
   * depending on it directly would re-fetch forever — the same shape of bug as
   * the /auth/me refetch loop.
   */
  const bagKey = React.useMemo(
    () =>
      lines
        .map((l) => `${l.variantId}:${l.qty}:${l.unitPriceMinor}`)
        .sort()
        .join('|'),
    [lines],
  );

  const linesRef = React.useRef(lines);
  linesRef.current = lines;

  const runPreview = React.useCallback(
    async (code: string, opts?: { silent?: boolean }) => {
      setBusy(true);
      setError(null);
      try {
        const result = await previewDiscount(linesRef.current, code);
        if (result.valid) {
          setApplied(result);
          saveAppliedCode(result.code);
          onChangeRef.current?.(result);
          track('promo_applied', {
            code: result.code ?? code,
            discountMinor: result.discountMinor,
          });
        } else {
          setApplied(null);
          saveAppliedCode(null);
          onChangeRef.current?.(null);
          // Silent when re-checking a code the shopper applied earlier: they
          // did not just do anything, so an error appearing out of nowhere as
          // they change quantity reads as the page breaking.
          if (!opts?.silent) {
            setError(result.message ?? "This code isn't valid.");
          }
          track('promo_rejected', {
            code,
            reason: result.message ?? 'invalid',
          });
        }
      } catch {
        setApplied(null);
        onChangeRef.current?.(null);
        if (!opts?.silent) {
          setError('We could not check that code just now. Please try again.');
        }
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  /**
   * Re-check the saved code whenever the bag changes.
   *
   * A percentage of a bag is not a fixed number: add an item and the saving
   * grows, remove one and it shrinks. Showing yesterday's figure against
   * today's bag would mean the summary and the amount charged disagree.
   */
  React.useEffect(() => {
    const saved = loadAppliedCode();
    if (!saved || lines.length === 0) return;
    setInput(saved);
    void runPreview(saved, { silent: true });
  }, [bagKey, runPreview, lines.length]);

  function remove() {
    setApplied(null);
    setInput('');
    setError(null);
    saveAppliedCode(null);
    onChangeRef.current?.(null);
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--mr-font-label)',
    fontSize: 'var(--mr-text-xs)',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--mr-fg-3)',
    display: 'block',
    marginBottom: 'var(--mr-sp-2)',
  };

  return (
    <div data-trace-id="EL-REGION-discount-code" style={{ marginTop: compact ? 0 : 'var(--mr-sp-4)' }}>
      {!compact && <label htmlFor="mr-discount-code" style={labelStyle}>Discount code</label>}

      {applied ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 'var(--mr-sp-3)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--mr-font-ui)',
              fontSize: 'var(--mr-text-sm)',
              color: 'var(--mr-fg-2)',
            }}
          >
            {applied.code}
          </span>
          <button
            type="button"
            onClick={remove}
            style={{
              background: 'none',
              border: 0,
              padding: 0,
              cursor: 'pointer',
              fontFamily: 'var(--mr-font-ui)',
              fontSize: 'var(--mr-text-xs)',
              color: 'var(--mr-fg-4)',
              textDecoration: 'underline',
            }}
          >
            Remove
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim()) void runPreview(input.trim());
          }}
          style={{ display: 'flex', gap: 'var(--mr-sp-2)' }}
        >
          <input
            id="mr-discount-code"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (error) setError(null);
            }}
            placeholder="MINIRUE-XXXXXX"
            // Codes are stored uppercase and the field accepts any case, but
            // showing it uppercase as they type means what they see matches
            // what they were sent.
            style={{
              flex: 1,
              minWidth: 0,
              padding: '10px 12px',
              border: '1px solid var(--mr-hairline)',
              borderRadius: 4,
              background: 'transparent',
              fontFamily: 'var(--mr-font-ui)',
              fontSize: 'var(--mr-text-sm)',
              textTransform: 'uppercase',
              color: 'var(--mr-fg)',
            }}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            style={{
              padding: '10px 16px',
              border: '1px solid var(--mr-fg)',
              borderRadius: 4,
              background: 'transparent',
              fontFamily: 'var(--mr-font-label)',
              fontSize: 'var(--mr-text-xs)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              cursor: busy || !input.trim() ? 'default' : 'pointer',
              opacity: busy || !input.trim() ? 0.4 : 1,
              color: 'var(--mr-fg)',
            }}
          >
            {busy ? 'Checking' : 'Apply'}
          </button>
        </form>
      )}

      {error && (
        <p
          role="status"
          style={{
            marginTop: 'var(--mr-sp-2)',
            marginBottom: 0,
            fontFamily: 'var(--mr-font-ui)',
            fontSize: 'var(--mr-text-xs)',
            color: 'var(--mr-fg-3)',
          }}
        >
          {error}
        </p>
      )}

      {applied && applied.appliesToMinirueOnly && (
        <p
          style={{
            marginTop: 'var(--mr-sp-2)',
            marginBottom: 0,
            fontFamily: 'var(--mr-font-ui)',
            fontSize: 'var(--mr-text-xs)',
            color: 'var(--mr-fg-4)',
          }}
        >
          Applies to MiniRue items only.
        </p>
      )}
    </div>
  );
}

export default DiscountCodeField;
