'use client';

/**
 * CancelButton — client component
 * Only rendered when order status is PENDING or CONFIRMED.
 * [TBD] Cancel endpoint path not defined in orders spec.
 */
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiCancelOrder } from '@/lib/api/orders';
import type { ApiError } from '@/lib/api/client';

interface Props {
  orderId: string;
}

export default function CancelButton({ orderId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  if (!confirmed) {
    return (
      <button
        onClick={() => setConfirmed(true)}
        style={{
          background: 'none',
          border: '1px solid var(--mr-danger)',
          borderRadius: 'var(--mr-radius-sm)',
          padding: '8px 18px',
          fontFamily: 'var(--mr-font-label)',
          fontSize: 'var(--mr-text-xs)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--mr-danger)',
          cursor: 'pointer',
        }}
      >
        Cancel Order
      </button>
    );
  }

  const handleCancel = async () => {
    setLoading(true);
    setError(null);
    try {
      await apiCancelOrder(orderId);
      router.refresh();
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      setError(apiErr.message ?? 'Failed to cancel order.');
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ fontSize: 'var(--mr-text-sm)', color: 'var(--mr-fg-2)', margin: 0 }}>
        Are you sure you want to cancel this order?
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={handleCancel}
          disabled={loading}
          style={{
            background: 'var(--mr-danger)',
            color: 'var(--mr-cream-100)',
            border: 'none',
            borderRadius: 'var(--mr-radius-sm)',
            padding: '8px 18px',
            fontFamily: 'var(--mr-font-label)',
            fontSize: 'var(--mr-text-xs)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Cancelling…' : 'Yes, Cancel'}
        </button>
        <button
          onClick={() => setConfirmed(false)}
          disabled={loading}
          style={{
            background: 'none',
            border: '1px solid var(--mr-border)',
            borderRadius: 'var(--mr-radius-sm)',
            padding: '8px 16px',
            fontFamily: 'var(--mr-font-label)',
            fontSize: 'var(--mr-text-xs)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--mr-fg-3)',
            cursor: 'pointer',
          }}
        >
          Keep Order
        </button>
      </div>
      {error && (
        <p role="alert" style={{ color: 'var(--mr-danger)', fontSize: 'var(--mr-text-sm)', margin: 0 }}>
          {error}
        </p>
      )}
    </div>
  );
}
