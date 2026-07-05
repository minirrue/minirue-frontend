'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiGetOrder, type OrderSummary } from '@/lib/checkout/checkout-api';

export default function OrderDetailPage() {
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
      <p className="mt-2 text-sm text-neutral-600">Status: {order.status}</p>
      <ul className="mt-8 divide-y">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between py-3 text-sm">
            <span>Qty {item.qty}</span>
            <span>{item.lineTotalAmount}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
