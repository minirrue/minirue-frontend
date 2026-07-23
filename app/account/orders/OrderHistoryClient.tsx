'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiListOrders, type OrderSummary } from '@/lib/checkout/checkout-api';
import { formatOrderRef } from '@/lib/orders/order-format';

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

      <ul className="mt-8 divide-y">
        {orders.map((o) => (
          <li key={o.id} className="py-4">
            <Link href={`/account/orders/${o.id}`} className="flex items-baseline justify-between hover:underline">
              <span>
                <span className="font-medium">{formatOrderRef(o)}</span>
                <span className="ml-2 text-xs text-neutral-500">{o.orderNumber}</span>
              </span>
              <span>{o.totalAmount} {o.totalCurrency}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
