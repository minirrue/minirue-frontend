'use client';

/**
 * CancelButton — client component
 * Only rendered when order status is PENDING or CONFIRMED.
 * [TBD] Cancel endpoint path not defined in orders spec.
 */
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiCancelOrder } from '@/lib/api/orders';
import { formatApiError, type ApiError } from '@/lib/api/client';
import Button from '@/components/ui/Button';

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
      <Button variant="dangerOutline" onClick={() => setConfirmed(true)}>
        Cancel Order
      </Button>
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
      setError(formatApiError(apiErr, 'Failed to cancel order.'));
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ fontSize: 'var(--mr-text-sm)', color: 'var(--mr-fg-2)', margin: 0 }}>
        Are you sure you want to cancel this order?
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <Button variant="danger" onClick={handleCancel} disabled={loading}>
          {loading ? 'Cancelling…' : 'Yes, Cancel'}
        </Button>
        <Button variant="outline" onClick={() => setConfirmed(false)} disabled={loading}>
          Keep Order
        </Button>
      </div>
      {error && (
        <p role="alert" style={{ color: 'var(--mr-danger)', fontSize: 'var(--mr-text-sm)', margin: 0 }}>
          {error}
        </p>
      )}
    </div>
  );
}
