'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiListMyRefunds, formatRefundStatus, type RefundTicket } from '@/lib/api/refunds';
import { apiGetOrder } from '@/lib/checkout/checkout-api';
import { formatOrderRef, formatOrderTotal } from '@/lib/orders/order-format';

/** Same tone convention OrderHistoryClient uses: in-progress vs. finished vs. stopped. */
const STATUS_TONE: Record<RefundTicket['status'], string> = {
  REQUESTED: 'var(--mr-gold-500)',
  UNDER_REVIEW: 'var(--mr-gold-500)',
  APPROVED: 'var(--mr-gold-500)',
  REFUNDED: 'var(--mr-fg-3)',
  REJECTED: 'var(--mr-crimson-700)',
  CANCELLED: 'var(--mr-crimson-700)',
};

// A refund ticket only carries orderId (a raw UUID) — RefundTicketDto on the
// backend has no order number or ref. Resolved here per distinct order via
// the existing order-detail endpoint (apiGetOrder), which the customer is
// already allowed to call for their own orders, rather than growing a second
// backend contract just for this list.
function useOrderRefs(orderIds: string[]) {
  const [refs, setRefs] = useState<Record<string, { orderNumber: string; orderSeq: number }>>(
    {},
  );

  useEffect(() => {
    let cancelled = false;
    const missing = orderIds.filter((id) => !(id in refs));
    if (missing.length === 0) return;
    void Promise.all(
      missing.map((id) =>
        apiGetOrder(id)
          .then((o) => [id, { orderNumber: o.orderNumber, orderSeq: o.orderSeq }] as const)
          .catch(() => [id, null] as const),
      ),
    ).then((pairs) => {
      if (cancelled) return;
      setRefs((prev) => {
        const next = { ...prev };
        for (const [id, ref] of pairs) {
          if (ref) next[id] = ref;
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderIds.join(',')]);

  return refs;
}

export default function RefundsPageClient() {
  const [tickets, setTickets] = useState<RefundTicket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void apiListMyRefunds()
      .then((res) => {
        setTickets(res.data);
        setError(null);
      })
      .catch(() => setError('Sign in to view your refunds.'))
      .finally(() => setLoaded(true));
  }, []);

  const orderRefs = useOrderRefs(Array.from(new Set(tickets.map((t) => t.orderId))));

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-serif">Your refunds</h1>

      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

      {!error && loaded && tickets.length === 0 && (
        <p className="mt-8 text-sm text-neutral-500">No refund requests yet.</p>
      )}

      <ul style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 32 }}>
        {tickets.map((ticket) => {
          const ref = orderRefs[ticket.orderId];
          return (
            <li
              key={ticket.id}
              style={{
                display: 'flex',
                gap: 16,
                alignItems: 'center',
                padding: 16,
                border: '1px solid var(--mr-border)',
                borderRadius: 'var(--mr-radius-md)',
                background: 'var(--mr-bg-raised)',
              }}
            >
              <Link
                href={`/account/orders/${ticket.orderId}`}
                style={{ flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 500 }}>
                    {ref ? formatOrderRef(ref) : 'Order'}
                  </span>
                  {ref && (
                    <span
                      style={{
                        fontFamily: 'var(--mr-font-mono, monospace)',
                        fontSize: 'var(--mr-text-xs)',
                        color: 'var(--mr-fg-4)',
                      }}
                    >
                      {ref.orderNumber}
                    </span>
                  )}
                </div>

                <div
                  style={{
                    fontSize: 'var(--mr-text-xs)',
                    color: 'var(--mr-fg-4)',
                    marginTop: 4,
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <span style={{ color: STATUS_TONE[ticket.status] ?? 'var(--mr-fg-3)' }}>
                    {formatRefundStatus(ticket.status)}
                  </span>
                  <span aria-hidden>·</span>
                  <span>
                    {new Date(ticket.createdAt).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </Link>

              <span style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
                {formatOrderTotal((ticket.requestedAmountCents / 100).toFixed(2), 'EGP')}
              </span>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
