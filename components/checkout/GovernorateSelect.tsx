'use client';

import React from 'react';
import {
  resolveGovernorateRate,
  selectableRates,
  type EffectiveShipping,
  type ResolvedGovernorateRate,
} from '@/lib/checkout/governorate-rates';

/**
 * The governorate field, as an enum the admin owns (#83).
 *
 * The owner's ask: "each governorate have a custom shipping fees so admin can
 * set global fees or custom governorate chosen on checkout as enum". The admin's
 * table IS the enum — nothing about Egypt's governorates is hardcoded here,
 * because a hardcoded list needs a deploy to fix a spelling.
 *
 * ## The two states this component exists to keep apart
 *
 * **No table.** `rates` is empty — which is what the live shop returns today,
 * and is the entire back-compat guarantee of #83. This renders the free-text
 * input it always rendered, because there is no enum to offer and a select with
 * one option reading "Other" is worse than a box. Nothing about the pre-#83
 * flow changes.
 *
 * **A table.** A real `<select>`, populated from the published rows, whose
 * choice moves the shipping row in the summary beside it.
 *
 * ## The case that is the whole issue
 *
 * `governorate` has been FREE TEXT on every address since the schema was
 * written, so saved addresses hold "Cairo", "cairo", "القاهرة", "Cairo
 * Governorate" and the literal '—' manual orders write. Matching normalises and
 * follows aliases, so most of those land on a row. Some will not.
 *
 * For a stored value that matches NO key, label or alias, this renders an extra
 * option carrying **the shopper's own text**, selects it, and says out loud what
 * it costs:
 *
 *     ⌄ Cairo Governorate — not in our delivery list
 *       We could not match this to a delivery area, so the standard rate
 *       (EGP 100.00) applies. Pick the closest match to see its exact fee.
 *
 * It does **not** snap to the first option: that silently moves somebody's
 * address to a different city. It does **not** quietly bill the global rate with
 * nothing on screen: that is the same invisible under-charge as the hardcoded
 * EGP 50 #79 removed, which is the defect #83 is about. The shopper keeps their
 * text, keeps their delivery, and can see the number they will be charged.
 *
 * ## Disabled rows
 *
 * Not offered. `minFeeCents` excludes them, so offering one would make the bag's
 * "from EGP X" quote a price the bag never counted. A saved address that already
 * NAMES a disabled governorate still resolves to it and still shows its real fee
 * — the backend charges that row either way (DECISION 3: modelled, not
 * enforced), so hiding it from this list must not change what anyone pays.
 */

/** The sentinel `<option>` value for "my text matched nothing". */
export const UNMATCHED_OPTION_VALUE = '__unmatched__';
/** The sentinel `<option>` value for the empty placeholder. */
const PLACEHOLDER_OPTION_VALUE = '';

export interface GovernorateSelectProps {
  /** The free text currently on the address. Never normalised, never replaced. */
  value: string;
  /**
   * Called with the FREE TEXT to store.
   *
   * A chosen row hands back its `label`, not its `key`. The key is
   * machine-facing — `north-sinai` is not something to print on a parcel — and
   * the backend's matcher sweeps KEY across the whole table before LABEL, so a
   * label can never be captured by another row's alias. The order snapshot
   * records the resolved key beside the text regardless.
   */
  onChange: (next: string) => void;
  effective: EffectiveShipping;
  error?: string;
  /** Rendered under the field: the fee this choice costs, supplied by the page. */
  hint?: React.ReactNode;
  id?: string;
}

const fieldWrap: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  // Same reason as every other field in this flow: without it a control inside
  // a grid track refuses to shrink below its intrinsic width and pushes the
  // column past the viewport.
  minWidth: 0,
};

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--mr-font-label)',
  fontSize: 'var(--mr-text-xs)',
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'var(--mr-fg-3)',
};

/**
 * Matched to `GuestDetailsForm`'s `inputStyle` deliberately — this control sits
 * directly beside those inputs and a select that looks like a different species
 * of field reads as a different kind of question.
 *
 * `appearance: none` plus a drawn chevron, because the platform control renders
 * at wildly different heights across iOS, Android and desktop and would be the
 * one field in the column that does not line up. 16px so iOS does not zoom on
 * focus.
 */
const selectStyle: React.CSSProperties = {
  font: 'inherit',
  fontSize: 16,
  padding: '12px 38px 12px 14px',
  borderRadius: 8,
  border: '1px solid color-mix(in srgb, var(--mr-fg) 45%, transparent)',
  background: 'var(--mr-bg-raised, #fff)',
  color: 'var(--mr-fg)',
  width: '100%',
  minWidth: 0,
  outline: 'none',
  appearance: 'none',
  WebkitAppearance: 'none',
  cursor: 'pointer',
  transition:
    'border-color var(--mr-dur-fast, 160ms) var(--mr-ease-out, ease), box-shadow var(--mr-dur-fast, 160ms) var(--mr-ease-out, ease)',
};

const inputStyle: React.CSSProperties = {
  ...selectStyle,
  padding: '12px 14px',
  // The select's chevron suppression and pointer are dropped: this is an
  // <input>, and it should look and behave like every other one on the form.
  appearance: undefined,
  WebkitAppearance: undefined,
  cursor: undefined,
};

const errorStyle: React.CSSProperties = {
  fontFamily: 'var(--mr-font-ui)',
  fontSize: 'var(--mr-text-xs)',
  color: 'var(--mr-danger, #c0392b)',
};

const hintStyle: React.CSSProperties = {
  fontFamily: 'var(--mr-font-ui)',
  fontSize: 'var(--mr-text-xs)',
  color: 'var(--mr-fg-4)',
};

/**
 * What the select should be showing for this free text, and why.
 *
 * Exported because the page needs the same answer to decide what to put in the
 * summary and whether to warn about COD — and two independent readings of one
 * string is how a screen ends up contradicting itself.
 */
export function governorateSelectValue(
  effective: EffectiveShipping,
  value: string,
): { optionValue: string; resolved: ResolvedGovernorateRate } {
  const resolved = resolveGovernorateRate(effective, value);

  if (resolved.status === 'MATCHED' || resolved.status === 'DISABLED') {
    return { optionValue: resolved.key ?? UNMATCHED_OPTION_VALUE, resolved };
  }
  // NO_GOVERNORATE covers blank, absent, and the placeholder punctuation a
  // manual order writes. There is nothing to show as "theirs", so the field
  // reads as unanswered rather than as a failed match.
  if (resolved.status === 'NO_GOVERNORATE') {
    return { optionValue: PLACEHOLDER_OPTION_VALUE, resolved };
  }
  return { optionValue: UNMATCHED_OPTION_VALUE, resolved };
}

export default function GovernorateSelect({
  value,
  onChange,
  effective,
  error,
  hint,
  id = 'governorate',
}: GovernorateSelectProps) {
  const options = React.useMemo(() => selectableRates(effective), [effective]);
  const { optionValue, resolved } = React.useMemo(
    () => governorateSelectValue(effective, value),
    [effective, value],
  );

  const describedBy =
    [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
      .filter(Boolean)
      .join(' ') || undefined;

  const borderFor = (focused: boolean) =>
    focused
      ? 'var(--mr-fg)'
      : error
        ? 'var(--mr-danger, #c0392b)'
        : 'color-mix(in srgb, var(--mr-fg) 45%, transparent)';

  // No table — the pre-#83 world, unchanged. A free-text box, exactly as before.
  if (options.length === 0) {
    return (
      <div style={fieldWrap}>
        <label htmlFor={id} style={labelStyle}>
          Governorate
        </label>
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="address-level1"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = borderFor(true);
            e.currentTarget.style.boxShadow =
              '0 0 0 3px color-mix(in srgb, var(--mr-fg) 12%, transparent)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = borderFor(false);
            e.currentTarget.style.boxShadow = 'none';
          }}
          style={{
            ...inputStyle,
            ...(error ? { borderColor: 'var(--mr-danger, #c0392b)' } : {}),
          }}
          data-trace-id="PG-STOREFRONT-CHK-002::EL-FIELD-guest-governorate"
        />
        {error && (
          <span id={`${id}-error`} role="alert" style={errorStyle}>
            {error}
          </span>
        )}
        {hint && (
          <span id={`${id}-hint`} style={hintStyle}>
            {hint}
          </span>
        )}
      </div>
    );
  }

  const unmatched = optionValue === UNMATCHED_OPTION_VALUE;

  return (
    <div style={fieldWrap}>
      <label htmlFor={id} style={labelStyle}>
        Governorate
      </label>
      <div style={{ position: 'relative', minWidth: 0 }}>
        <select
          id={id}
          value={optionValue}
          onChange={(e) => {
            const next = e.target.value;
            // Choosing the sentinel is a no-op on the stored text: it is the
            // option that REPRESENTS their text, not one that replaces it.
            if (next === UNMATCHED_OPTION_VALUE) return;
            if (next === PLACEHOLDER_OPTION_VALUE) {
              onChange('');
              return;
            }
            const rate = options.find((r) => r.key === next);
            onChange(rate ? rate.label : '');
          }}
          autoComplete="address-level1"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = borderFor(true);
            e.currentTarget.style.boxShadow =
              '0 0 0 3px color-mix(in srgb, var(--mr-fg) 12%, transparent)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = borderFor(false);
            e.currentTarget.style.boxShadow = 'none';
          }}
          style={{
            ...selectStyle,
            ...(error ? { borderColor: 'var(--mr-danger, #c0392b)' } : {}),
          }}
          data-trace-id="PG-STOREFRONT-CHK-002::EL-FIELD-guest-governorate"
        >
          <option value={PLACEHOLDER_OPTION_VALUE} disabled>
            Select your governorate
          </option>
          {/*
            The shopper's own words, kept as an option rather than discarded.
            Rendered only when their text matched nothing — a matched address
            has a real row to sit on and does not need this.
          */}
          {unmatched && (
            <option value={UNMATCHED_OPTION_VALUE}>
              {resolved.governorate} — not in our delivery list
            </option>
          )}
          {options.map((rate) => (
            <option key={rate.key} value={rate.key}>
              {rate.label}
            </option>
          ))}
        </select>
        {/*
          The chevron `appearance: none` removed. `pointer-events: none` so it
          is decoration over the control rather than a hole in it — clicking the
          arrow must open the select, which is where everyone clicks.
        */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            color: 'var(--mr-fg-3)',
            fontSize: 11,
            lineHeight: 1,
          }}
        >
          ▼
        </span>
      </div>
      {error && (
        <span id={`${id}-error`} role="alert" style={errorStyle}>
          {error}
        </span>
      )}
      {hint && (
        <span id={`${id}-hint`} style={hintStyle}>
          {hint}
        </span>
      )}
    </div>
  );
}
