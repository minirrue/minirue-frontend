'use client';

import React from 'react';
import Link from 'next/link';
import { useClientQuery } from '@/lib/hooks/use-client-query';
import { apiGetOrders, type Order, type OrderStatus } from '@/lib/api/orders';

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING: 'var(--mr-warning)',
  CONFIRMED: 'var(--mr-accent)',
  PROCESSING: 'var(--mr-accent)',
  SHIPPED: 'var(--mr-gold-400)',
  DELIVERED: 'var(--mr-success)',
  CANCELLED: 'var(--mr-fg-4)',
};

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 'var(--mr-text-xs)',
        fontFamily: 'var(--mr-font-label)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: STATUS_COLORS[status],
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: STATUS_COLORS[status],
          display: 'inline-block',
        }}
      />
      {STATUS_LABELS[status]}
    </span>
  );
}

function OrderRow({ order }: { order: Order }) {
  return (
    <Link
      href={`/account/orders/${order.id}`}
      style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 1fr 1fr',
        gap: 16,
        alignItems: 'center',
        padding: '14px 0',
        borderBottom: '1px solid var(--mr-hairline)',
        textDecoration: 'none',
        color: 'inherit',
        transition: `opacity var(--mr-dur-fast) var(--mr-ease-out)`,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--mr-font-ui)',
          fontSize: 'var(--mr-text-sm)',
          color: 'var(--mr-fg)',
          fontWeight: 500,
        }}
      >
        {order.orderNumber}
      </span>
      <span style={{ fontSize: 'var(--mr-text-sm)', color: 'var(--mr-fg-3)' }}>
        {new Date(order.createdAt).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}
      </span>
      <OrderStatusBadge status={order.status} />
      <span
        style={{
          fontSize: 'var(--mr-text-sm)',
          fontWeight: 500,
          color: 'var(--mr-fg)',
          textAlign: 'right',
        }}
      >
        {order.totalCurrency}{' '}
        {parseFloat(order.totalAmount).toLocaleString('en-EG', { minimumFractionDigits: 2 })}
      </span>
    </Link>
  );
}

export default function OrdersPageClient() {
  const { data, isLoading, isError, refetch } = useClientQuery({
    queryKey: ['account', 'orders'],
    queryFn: () => apiGetOrders({ limit: 20 }),
  });
  const orders = data?.data ?? [];

  return (
    <>
      <h1
        style={{
          fontFamily: 'var(--mr-font-label)',
          fontSize: 'var(--mr-text-xl)',
          fontWeight: 600,
          margin: '0 0 28px',
          color: 'var(--mr-fg)',
        }}
      >
        Order History
      </h1>

      {isLoading && (
        <p style={{ color: 'var(--mr-fg-4)', fontSize: 'var(--mr-text-sm)' }}>Loading orders…</p>
      )}

      {isError && (
        <div>
          <p role="alert" style={{ color: 'var(--mr-danger)', fontSize: 'var(--mr-text-sm)' }}>
            Unable to load orders. Please try again.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            style={{
              marginTop: 12,
              background: 'transparent',
              border: '1px solid var(--mr-border)',
              borderRadius: 'var(--mr-radius-sm)',
              padding: '8px 16px',
              fontSize: 'var(--mr-text-sm)',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !isError && orders.length === 0 && (
        <p style={{ color: 'var(--mr-fg-4)', fontSize: 'var(--mr-text-sm)' }}>No orders yet.</p>
      )}

      {orders.length > 0 && (
        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1fr',
              gap: 16,
              padding: '0 0 10px',
              borderBottom: '1px solid var(--mr-border)',
            }}
          >
            {['Order', 'Date', 'Status', 'Total'].map((h, i) => (
              <span
                key={h}
                style={{
                  fontFamily: 'var(--mr-font-label)',
                  fontSize: 'var(--mr-text-xs)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--mr-fg-4)',
                  textAlign: i === 3 ? 'right' : 'left',
                }}
              >
                {h}
              </span>
            ))}
          </div>

          {orders.map((order) => (
            <OrderRow key={order.id} order={order} />
          ))}
        </div>
      )}
    </>
  );
}
