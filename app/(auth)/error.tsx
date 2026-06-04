'use client';

import React from 'react';
import AuthShell from '@/components/auth/AuthShell';

export default function AuthError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <AuthShell>
      <div style={{ textAlign: 'center' }}>
        <h2
          style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontSize: 26,
            fontWeight: 500,
            color: 'var(--mr-ink-900)',
            marginBottom: 12,
          }}
        >
          Something went wrong
        </h2>
        <p
          style={{
            fontFamily: 'Inter Tight, sans-serif',
            fontSize: 14,
            color: 'var(--mr-ink-500)',
            marginBottom: 28,
          }}
        >
          {error.message || 'An unexpected error occurred.'}
        </p>
        <button
          onClick={reset}
          style={{
            fontFamily: 'Jost, sans-serif',
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--mr-gold-500)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </div>
    </AuthShell>
  );
}
