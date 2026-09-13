'use client';

import React from 'react';
import {
  type DiscountPreview,
  INVALID_CODE_MESSAGE,
  loadAppliedCode,
  previewDiscount,
  saveAppliedCode,
} from '@/lib/api/discounts';
import { track } from '@/lib/analytics/track';
import Button from '@/components/ui/Button';

/**
 * Where a shopper types `MINIRUE-K7P2X4` — or a campaign code like `MINIRUE10`.
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

/** How long the bag must stay still before an applied code is re-priced. */
const RECHECK_DEBOUNCE_MS = 400;

export function DiscountCodeField({
  lines,
  onChange,
  compact = false,
  guestPhone,
}: {
  lines: DiscountLine[];
  /** Fires whenever the saving changes, including on removal (0). */
  onChange?: (preview: DiscountPreview | null) => void;
  compact?: boolean;
  /** A guest's phone once Delivery has it — see previewDiscount. */
  guestPhone?: string;
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
  // After commit, not during render: a discarded render must not leave this
  // holding lines the shopper never saw. `runPreview` reads it from a submit
  // handler, which cannot fire before the commit that follows, so it still sees
  // the current basket.
  React.useEffect(() => {
    linesRef.current = lines;
  });

  const guestPhoneRef = React.useRef(guestPhone);
  React.useEffect(() => {
    guestPhoneRef.current = guestPhone;
  });

  const runPreview = React.useCallback(
    async (code: string, opts?: { silent?: boolean }) => {
      setBusy(true);
      setError(null);
      try {
        const phone = guestPhoneRef.current?.trim();
        const result = phone
          ? await previewDiscount(linesRef.current, code, { guestPhone: phone })
          : await previewDiscount(linesRef.current, code);
        if (result.valid) {
          /**
           * The STORED code when the server names it (`MINIRUE10`), otherwise
           * exactly what the shopper typed — never nothing.
           *
           * This saved `result.code` alone, and the server echoed null for
           * every admin-named code, so an accepted `MINIRUE10` left
           * localStorage empty, Place order sent no code, and the order was
           * charged full price (minirue-backend#120). The typed text is safe
           * to keep: the server re-resolves it from scratch at placement.
           */
          const kept = result.code ?? code;
          setApplied({ ...result, code: kept });
          saveAppliedCode(kept);
          onChangeRef.current?.(result);
          track('promo_applied', {
            code: kept,
            discountMinor: result.discountMinor,
          });
        } else {
          setApplied(null);
          saveAppliedCode(null);
          onChangeRef.current?.(null);
          /**
           * Shown on a silent re-check too. It used to stay quiet, so a code
           * that expired, or stopped fitting the bag, vanished along with the
           * saving and the total simply went up with no word why — the same
           * "charged more than the screen said" the issue was about. It is the
           * one generic sentence, so it says nothing about the reason.
           */
          setError(result.message ?? INVALID_CODE_MESSAGE);
          track('promo_rejected', {
            code,
            reason: result.message ?? 'invalid',
          });
        }
      } catch (err: unknown) {
        const status = (err as { status?: unknown } | null)?.status;
        if (opts?.silent) {
          /**
           * A re-check that could not be answered (rate limited, offline)
           * says NOTHING about the code, so the code stays applied and saved.
           * Clearing it here is how a shopper adjusting quantities lost a
           * valid code to a 429 (minirue-backend#120). Place order
           * re-validates it regardless, and refuses clearly if it is dead.
           */
          return;
        }
        setApplied(null);
        onChangeRef.current?.(null);
        setError(
          status === 429
            ? 'Too many tries just now. Please wait a few minutes and try again.'
            : 'We could not check that code just now. Please try again.',
        );
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
   *
   * The first check runs at once; later ones wait for the bag to settle, so
   * tapping + five times costs one request, not five.
   */
  const checkedOnce = React.useRef(false);
  React.useEffect(() => {
    const saved = loadAppliedCode();
    if (!saved || lines.length === 0) return;
    setInput(saved);
    if (!checkedOnce.current) {
      checkedOnce.current = true;
      void runPreview(saved, { silent: true });
      return;
    }
    const timer = setTimeout(() => void runPreview(saved, { silent: true }), RECHECK_DEBOUNCE_MS);
    return () => clearTimeout(timer);
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
          // `stretch` so the input takes the button's height (frontend#105) —
          // the two read as one control rather than a short box beside a pill.
          style={{ display: 'flex', alignItems: 'stretch', gap: 'var(--mr-sp-2)' }}
        >
          <input
            id="mr-discount-code"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (error) setError(null);
            }}
            // Not a MINIRUE-XXXXXX mask: admin-named codes (MINIRUE10) are
            // just as valid, and a format hint made them look wrong.
            placeholder="Enter code"
            // Codes are stored uppercase and the field accepts any case, but
            // showing it uppercase as they type means what they see matches
            // what they were sent.
            style={{
              flex: 1,
              minWidth: 0,
              padding: '0 18px',
              border: '1px solid var(--mr-hairline)',
              borderRadius: 'var(--mr-radius-pill)',
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
          {/* A floor wide enough for "Checking", so the pill does not jump
              when the label swaps mid-request. */}
          <Button
            variant="outline"
            type="submit"
            disabled={busy || !input.trim()}
            style={{ flexShrink: 0, minWidth: 116 }}
          >
            {busy ? 'Checking' : 'Apply'}
          </Button>
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
