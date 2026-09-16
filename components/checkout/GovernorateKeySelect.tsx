'use client';

import React from 'react';
import { GOVERNORATES, type GovernorateKey } from '@/lib/checkout/governorates';

/**
 * The governorate FIELD on an address, as the closed enum (#158/#163).
 *
 * Deliberately a new, small component rather than a repurposed
 * `GovernorateSelect` (components/checkout/GovernorateSelect.tsx). That one
 * exists for a different, older concern — #83's per-governorate SHIPPING RATE
 * table, where the stored value is free text matched (with fallbacks) against
 * an admin-owned table, and it must keep working unchanged for that: it is
 * still what the checkout summary uses to quote a delivery fee, and its own
 * test suite (`__tests__/checkout/governorate-select.test.tsx`) pins that free
 * text is stored verbatim, including the case where it matches nothing.
 *
 * This component is for a different job: the ADDRESS's governorate is now one
 * of exactly 27 keys (`lib/checkout/governorates.ts`), full stop — no free
 * text, no partial match, no admin table. Overloading `GovernorateSelect` to
 * also do this would have tangled two independent closed/open-ended value
 * spaces (a shipping-rate label vs. a `GovernorateKey`) behind one prop
 * contract, which is worse than two small components that each do one thing.
 *
 * `value` is `''` for "nothing chosen yet" — including a saved address whose
 * legacy free text did not resolve to any of the 27 keys via
 * `resolveGovernorateKey()`. The caller is responsible for running that
 * resolution before handing a value in; this component only ever shows or
 * picks a real key, and never invents one.
 */

export interface GovernorateKeySelectProps {
  value: GovernorateKey | '';
  onChange: (next: GovernorateKey) => void;
  id?: string;
  label?: string;
  error?: string;
  required?: boolean;
}

const fieldWrap: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
  minWidth: 0,
};

const labelTextStyle: React.CSSProperties = {
  fontFamily: 'var(--mr-font-label)',
  fontSize: 'var(--mr-text-xs)',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--mr-fg-4)',
};

const selectStyle: React.CSSProperties = {
  border: '1px solid var(--mr-border)',
  borderRadius: 'var(--mr-radius-sm)',
  padding: '8px 34px 8px 12px',
  fontSize: 'var(--mr-text-sm)',
  fontFamily: 'var(--mr-font-ui)',
  color: 'var(--mr-fg)',
  background: 'var(--mr-bg-raised)',
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  appearance: 'none',
  WebkitAppearance: 'none',
  cursor: 'pointer',
  outline: 'none',
};

const errorStyle: React.CSSProperties = {
  fontFamily: 'var(--mr-font-ui)',
  fontSize: 'var(--mr-text-xs)',
  color: 'var(--mr-danger, #c0392b)',
};

export default function GovernorateKeySelect({
  value,
  onChange,
  id = 'governorate',
  label = 'Governorate',
  error,
  required = true,
}: GovernorateKeySelectProps) {
  const describedBy = error ? `${id}-error` : undefined;

  return (
    <div style={fieldWrap}>
      <label htmlFor={id} style={labelTextStyle}>
        {label}
      </label>
      <div style={{ position: 'relative', minWidth: 0 }}>
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value as GovernorateKey)}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          style={{
            ...selectStyle,
            ...(error ? { borderColor: 'var(--mr-danger, #c0392b)' } : {}),
          }}
        >
          <option value="" disabled>
            Select governorate
          </option>
          {GOVERNORATES.map((g) => (
            <option key={g.key} value={g.key}>
              {g.en}
            </option>
          ))}
        </select>
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            color: 'var(--mr-fg-3)',
            fontSize: 10,
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
    </div>
  );
}
