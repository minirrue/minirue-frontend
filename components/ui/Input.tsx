'use client';

import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  id: string;
  /** RULEBOOK §27 — full data-trace-id for this field's INPUT, e.g.
   * "PG-STOREFRONT-IAM-001::EL-FIELD-email". Caller-supplied because this component is reused
   * across every auth screen, each with its own PG-* id. */
  traceId?: string;
}

export default function Input({ label, error, id, className: _c, style: _s, traceId, ...props }: InputProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label
          htmlFor={id}
          style={{
            fontFamily: 'Jost, sans-serif',
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: error ? 'var(--mr-crimson-700)' : 'var(--mr-ink-500)',
          }}
        >
          {label}
        </label>
      )}
      <input
        id={id}
        data-trace-id={traceId}
        {...props}
        style={{
          width: '100%',
          padding: '13px 0',
          background: 'transparent',
          border: 'none',
          borderBottom: `1.5px solid ${error ? 'var(--mr-crimson-700)' : 'var(--mr-hairline)'}`,
          outline: 'none',
          fontFamily: 'Inter Tight, sans-serif',
          fontSize: 15,
          color: 'var(--mr-ink-900)',
          transition: 'border-color 220ms var(--mr-ease-out), box-shadow 220ms var(--mr-ease-out)',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderBottomColor = 'var(--mr-gold-500)';
          e.currentTarget.style.boxShadow = '0 2px 0 0 rgba(187,148,82,0.18)';
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderBottomColor = error ? 'var(--mr-crimson-700)' : 'var(--mr-hairline)';
          e.currentTarget.style.boxShadow = 'none';
          props.onBlur?.(e);
        }}
      />
      {error && (
        <span
          style={{
            fontFamily: 'Inter Tight, sans-serif',
            fontSize: 12,
            color: 'var(--mr-crimson-700)',
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
