'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiCreateRefund, type RefundMethod } from '@/lib/api/refunds';

const METHOD_OPTIONS: Array<{ value: RefundMethod; label: string }> = [
  { value: 'ORIGINAL_PAYMENT', label: 'Original Payment Method' },
  { value: 'STORE_CREDIT', label: 'Store Credit' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
];

export default function RefundRequestClient({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [method, setMethod] = useState<RefundMethod>('ORIGINAL_PAYMENT');
  const [amountEgp, setAmountEgp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cents = Math.round(parseFloat(amountEgp) * 100);
    if (!cents || cents <= 0) { setError('Please enter a valid amount.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      await apiCreateRefund({ orderId, method, requestedAmountCents: cents, reason });
      router.push(`/account/orders/${orderId}?refund=requested`);
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'Failed to submit refund request.');
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 480 }}>
      <Link
        href={`/account/orders/${orderId}`}
        style={{
          fontSize: 'var(--mr-text-xs)',
          fontFamily: 'var(--mr-font-label)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--mr-fg-4)',
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 28,
        }}
      >
        ← Back to Order
      </Link>

      <h1
        style={{
          fontFamily: 'var(--mr-font-label)',
          fontSize: 'var(--mr-text-xl)',
          fontWeight: 600,
          margin: '0 0 28px',
          color: 'var(--mr-fg)',
        }}
      >
        Request Refund
      </h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label style={{ display: 'block', fontSize: 'var(--mr-text-xs)', fontFamily: 'var(--mr-font-label)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mr-fg-4)', marginBottom: 6 }}>
            Refund Amount (EGP) *
          </label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amountEgp}
            onChange={(e) => setAmountEgp(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '10px 14px',
              border: '1px solid var(--mr-border)',
              borderRadius: 'var(--mr-radius-sm)',
              background: 'var(--mr-bg-raised)',
              color: 'var(--mr-fg)',
              fontSize: 'var(--mr-text-sm)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 'var(--mr-text-xs)', fontFamily: 'var(--mr-font-label)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mr-fg-4)', marginBottom: 6 }}>
            Refund Method *
          </label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as RefundMethod)}
            style={{
              width: '100%',
              padding: '10px 14px',
              border: '1px solid var(--mr-border)',
              borderRadius: 'var(--mr-radius-sm)',
              background: 'var(--mr-bg-raised)',
              color: 'var(--mr-fg)',
              fontSize: 'var(--mr-text-sm)',
              boxSizing: 'border-box',
            }}
          >
            {METHOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 'var(--mr-text-xs)', fontFamily: 'var(--mr-font-label)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mr-fg-4)', marginBottom: 6 }}>
            Reason *
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            minLength={10}
            rows={4}
            style={{
              width: '100%',
              padding: '10px 14px',
              border: '1px solid var(--mr-border)',
              borderRadius: 'var(--mr-radius-sm)',
              background: 'var(--mr-bg-raised)',
              color: 'var(--mr-fg)',
              fontSize: 'var(--mr-text-sm)',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {error && (
          <p style={{ color: 'var(--mr-danger)', fontSize: 'var(--mr-text-sm)', margin: 0 }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: '12px 28px',
            background: 'var(--mr-fg)',
            color: 'var(--mr-bg)',
            border: 'none',
            borderRadius: 'var(--mr-radius-pill)',
            fontFamily: 'var(--mr-font-label)',
            fontSize: 'var(--mr-text-xs)',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? 'Submitting…' : 'Submit Request'}
        </button>
      </form>
    </div>
  );
}
