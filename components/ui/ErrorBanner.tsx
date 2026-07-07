'use client';

import React from 'react';

export interface ErrorBannerProps {
  message: string;
  animated?: boolean;
  onDismiss?: () => void;
  /** RULEBOOK §27 — full data-trace-id for this banner's REGION, e.g.
   * "PG-STOREFRONT-IAM-001::EL-REGION-api-error-banner". Caller-supplied because this component
   * is reused across every screen, each with its own PG-* id. */
  traceId?: string;
  /** §27 — full data-trace-id for the Dismiss button, when `onDismiss` is passed. */
  dismissTraceId?: string;
}

export default function ErrorBanner({ message, animated = true, onDismiss, traceId, dismissTraceId }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      data-motion-tier="low"
      data-trace-id={traceId}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '12px 16px',
        background: 'var(--mr-crimson-100)',
        color: 'var(--mr-crimson-700)',
        borderRadius: 'var(--mr-radius-md)',
        fontFamily: 'Inter Tight, sans-serif',
        fontSize: 13,
        fontWeight: 500,
        animation: animated ? 'mr-fade-up 0.25s ease-out' : undefined,
      }}
    >
      <span style={{ flex: 1 }}>{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss error"
          data-trace-id={dismissTraceId}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--mr-crimson-700)',
            fontFamily: 'Jost, sans-serif',
            fontSize: 11,
            textTransform: 'uppercase',
            cursor: 'pointer',
            minWidth: 32,
            minHeight: 32,
          }}
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
