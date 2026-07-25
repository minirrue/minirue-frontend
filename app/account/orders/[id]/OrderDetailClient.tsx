'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  formatOrderStatus,
  formatOrderTotal,
} from '@/lib/orders/order-format';
import { useParams } from 'next/navigation';
import { apiGetOrder, type OrderSummary } from '@/lib/checkout/checkout-api';

export default function OrderDetailClient() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderSummary | null>(null);

  useEffect(() => {
    if (!id) return;
    void apiGetOrder(id).then(setOrder).catch(() => setOrder(null));
  }, [id]);

  if (!order) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <p className="text-neutral-600">Loading order…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <Link href="/account/orders" className="text-sm underline">
        ← Back to orders
      </Link>
      <h1 className="mt-4 text-2xl font-serif">{order.orderNumber}</h1>
      <p className="mt-2 text-sm text-neutral-600">
        {formatOrderStatus(order.status)}
        {order.createdAt
          ? ` · ${new Date(order.createdAt).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}`
          : ''}
      </p>

      {/* Lines said only "Qty 1" and a raw amount — nothing about WHAT was
          bought, which is the one thing a customer opens this page for. */}
      <ul style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 32 }}>
        {order.items.map((item) => {
          const snap = item.productSnapshot;
          const detail = Object.entries(snap?.variantValues ?? {})
            .map(([k, v]) => `${v} ${k}`)
            .join(' · ');
          return (
            <li
              key={item.id}
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
              {snap?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={snap.imageUrl}
                  alt=""
                  width={64}
                  height={80}
                  style={{
                    width: 64,
                    height: 80,
                    objectFit: 'cover',
                    borderRadius: 'var(--mr-radius-sm)',
                    border: '1px solid var(--mr-border)',
                    flexShrink: 0,
                  }}
                />
              ) : (
                <div
                  aria-hidden
                  style={{
                    width: 64,
                    height: 80,
                    borderRadius: 'var(--mr-radius-sm)',
                    border: '1px solid var(--mr-border)',
                    background: 'var(--mr-bg-sunken)',
                    flexShrink: 0,
                  }}
                />
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500 }}>{snap?.name ?? 'Item'}</div>
                {snap?.brand && (
                  <div style={{ fontSize: 'var(--mr-text-xs)', color: 'var(--mr-fg-4)', marginTop: 2 }}>
                    {snap.brand}
                  </div>
                )}
                {detail && (
                  <div style={{ fontSize: 'var(--mr-text-xs)', color: 'var(--mr-fg-3)', marginTop: 4 }}>
                    {detail}
                  </div>
                )}
                <div style={{ fontSize: 'var(--mr-text-xs)', color: 'var(--mr-fg-4)', marginTop: 4 }}>
                  Qty {item.qty}
                </div>
              </div>

              <span style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
                {formatOrderTotal(item.lineTotalAmount, order.totalCurrency)}
              </span>
            </li>
          );
        })}
      </ul>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 20,
          paddingTop: 16,
          borderTop: '1px solid var(--mr-border)',
          fontWeight: 500,
        }}
      >
        <span>Total</span>
        <span>{formatOrderTotal(order.totalAmount, order.totalCurrency)}</span>
      </div>
    </main>
  );
}
