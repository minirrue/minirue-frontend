'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiListOrders, type OrderSummary } from '@/lib/checkout/checkout-api';
import {
  formatOrderRef,
  formatOrderStatus,
  formatOrderTotal,
} from '@/lib/orders/order-format';

/** Statuses that read as "in progress" versus finished or stopped. */
const STATUS_TONE: Record<string, string> = {
  PENDING: 'var(--mr-gold-500)',
  CONFIRMED: 'var(--mr-gold-500)',
  PROCESSING: 'var(--mr-gold-500)',
  SHIPPED: 'var(--mr-gold-500)',
  DELIVERED: 'var(--mr-fg-3)',
  CANCELLED: 'var(--mr-crimson-700)',
  REFUNDED: 'var(--mr-crimson-700)',
};

function OrderCard({ order }: { order: OrderSummary }) {
  // Up to three thumbnails; beyond that a summary becomes a gallery.
  const thumbs = order.items
    .map((item) => item.productSnapshot?.imageUrl)
    .filter((url): url is string => !!url)
    .slice(0, 3);

  const firstName = order.items[0]?.productSnapshot?.name;
  const extra = order.items.length - 1;
  const itemLabel = firstName
    ? extra > 0
      ? `${firstName} + ${extra} more`
      : firstName
    : `${order.items.length} item${order.items.length === 1 ? '' : 's'}`;

  return (
    <li>
      <Link
        href={`/account/orders/${order.id}`}
        style={{
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          padding: 16,
          border: '1px solid var(--mr-border)',
          borderRadius: 'var(--mr-radius-md)',
          background: 'var(--mr-bg-raised)',
          textDecoration: 'none',
          color: 'inherit',
          transition: 'border-color var(--mr-dur-fast) var(--mr-ease-out)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--mr-fg-4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--mr-border)';
        }}
      >
        {/* Overlapped so several items still fit on a phone. */}
        <div style={{ display: 'flex', flexShrink: 0 }}>
          {thumbs.length > 0 ? (
            thumbs.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${url}-${i}`}
                src={url}
                alt=""
                width={56}
                height={70}
                style={{
                  width: 56,
                  height: 70,
                  objectFit: 'cover',
                  borderRadius: 'var(--mr-radius-sm)',
                  border: '1px solid var(--mr-border)',
                  background: 'var(--mr-bg-sunken)',
                  marginLeft: i === 0 ? 0 : -20,
                  position: 'relative',
                  zIndex: thumbs.length - i,
                }}
              />
            ))
          ) : (
            // No cover on any line — a placeholder keeps every card the same
            // height instead of some rows collapsing.
            <div
              aria-hidden
              style={{
                width: 56,
                height: 70,
                borderRadius: 'var(--mr-radius-sm)',
                border: '1px solid var(--mr-border)',
                background: 'var(--mr-bg-sunken)',
              }}
            />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 500 }}>{formatOrderRef(order)}</span>
            <span
              style={{
                fontFamily: 'var(--mr-font-mono, monospace)',
                fontSize: 'var(--mr-text-xs)',
                color: 'var(--mr-fg-4)',
              }}
            >
              {order.orderNumber}
            </span>
          </div>

          <div
            style={{
              fontSize: 'var(--mr-text-sm)',
              color: 'var(--mr-fg-2)',
              marginTop: 4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {itemLabel}
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
            <span style={{ color: STATUS_TONE[order.status] ?? 'var(--mr-fg-3)' }}>
              {formatOrderStatus(order.status)}
            </span>
            <span aria-hidden>·</span>
            <span>
              {new Date(order.createdAt).toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>

        <span style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
          {formatOrderTotal(order.totalAmount, order.totalCurrency)}
        </span>
      </Link>
    </li>
  );
}

export default function OrderHistoryClient() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    void apiListOrders(1, 10, debounced || undefined)
      .then((res) => {
        setOrders(res.data);
        setError(null);
      })
      .catch(() => setError('Sign in to view your orders.'));
  }, [debounced]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-serif">Your orders</h1>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by order number, e.g. 47"
        aria-label="Search your orders by order number"
        className="mt-6 w-full max-w-xs rounded border border-neutral-300 bg-transparent px-3 py-2 text-sm"
      />

      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

      {!error && orders.length === 0 && (
        <p className="mt-8 text-sm text-neutral-500">
          {debounced ? `No order matches "${debounced}".` : 'No orders yet.'}
        </p>
      )}

      <ul style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 32 }}>
        {orders.map((o) => (
          <OrderCard key={o.id} order={o} />
        ))}
      </ul>
    </main>
  );
}
