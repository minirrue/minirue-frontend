'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiListOrders, type OrderSummary } from '@/lib/checkout/checkout-api';

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiListOrders()
      .then((res) => setOrders(res.data))
      .catch(() => setError('Sign in to view your orders.'));
  }, []);

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-serif">Your orders</h1>
      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
      <ul className="mt-8 divide-y">
        {orders.map((o) => (
          <li key={o.id} className="py-4">
            <Link href={`/account/orders/${o.id}`} className="hover:underline">
              {o.orderNumber} — {o.totalAmount} {o.totalCurrency}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
