'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import RemoteImage from '@/components/ui/RemoteImage';
import { apiListOrders, type OrderSummary } from '@/lib/checkout/checkout-api';
import { apiListMyRefunds, type RefundStatus } from '@/lib/api/refunds';
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

/**
 * A status the shopper can actually find.
 *
 * It used to be tinted text sitting in the same small grey line as the date,
 * separated by a dot — the single most important word on the row rendered at
 * the same weight as everything around it. This is the same palette, given a
 * tinted chip so the eye lands on it (owner, 2026-08-23).
 *
 * `color-mix` rather than a second hard-coded colour per status: the fill is
 * always the status's own tone at 12%, so adding a status needs one entry
 * above and nothing here.
 */
function StatusPill({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 'var(--mr-text-xs)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: tone,
        background: `color-mix(in srgb, ${tone} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${tone} 28%, transparent)`,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

/**
 * Where a refund REQUEST has got to, in the shopper's words.
 *
 * The row already showed "x refunded" — but only once the money had actually
 * moved. Between asking and being paid, which is the stretch a shopper checks
 * this page most, there was nothing at all: their request appeared to have
 * vanished (owner, 2026-08-23). CANCELLED and REJECTED are deliberately shown
 * too; a refused refund the shopper is never told about is worse than a slow
 * one.
 */
const REFUND_LABEL: Record<RefundStatus, string> = {
  REQUESTED: 'Refund requested',
  UNDER_REVIEW: 'Refund under review',
  APPROVED: 'Refund approved',
  REFUNDED: 'Refunded',
  REJECTED: 'Refund declined',
  CANCELLED: 'Refund cancelled',
};

const REFUND_TONE: Record<RefundStatus, string> = {
  REQUESTED: 'var(--mr-gold-500)',
  UNDER_REVIEW: 'var(--mr-gold-500)',
  APPROVED: 'var(--mr-gold-700)',
  REFUNDED: 'var(--mr-crimson-700)',
  REJECTED: 'var(--mr-crimson-700)',
  CANCELLED: 'var(--mr-fg-3)',
};

function OrderCard({ order, refundStatus }: { order: OrderSummary; refundStatus?: RefundStatus }) {
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
              // Optimized (#11). An order card stacks up to three of these
              // and the page lists every order the customer has ever placed,
              // so this is the most image-dense screen in the account area.
              <RemoteImage
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
            <StatusPill tone={STATUS_TONE[order.status] ?? 'var(--mr-fg-3)'}>
              {formatOrderStatus(order.status)}
            </StatusPill>
            {/* Beside the order status, not instead of it: an order can be
                DELIVERED and have a refund under review at the same time, and
                collapsing the two would hide whichever the shopper came for.
                Suppressed once the order status already says REFUNDED — at
                that point the two say the same thing. */}
            {refundStatus && order.status !== 'REFUNDED' && (
              <StatusPill tone={REFUND_TONE[refundStatus]}>
                {REFUND_LABEL[refundStatus]}
              </StatusPill>
            )}
            <span aria-hidden>·</span>
            <span>
              {new Date(order.createdAt).toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>

          {/* Only the amount goes here — the word "Refunded" is already the
              status above; repeating it would just be noise. */}
          {!!order.refundedAmountCents && (
            <div
              style={{
                fontSize: 'var(--mr-text-xs)',
                color: 'var(--mr-fg-4)',
                marginTop: 4,
              }}
            >
              {formatOrderTotal(
                (order.refundedAmountCents / 100).toFixed(2),
                order.totalCurrency,
              )}{' '}
              refunded
            </div>
          )}
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
  /**
   * Refund status per order id. Its own read rather than a field on the order:
   * a refund is a ticket against an order, not a property of it, and one
   * failing must never blank the order list — hence the silent catch below.
   */
  const [refundByOrder, setRefundByOrder] = useState<Record<string, RefundStatus>>({});
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

  // Not keyed to the search box: the tickets are the shopper's own and the
  // list is short, so fetching once is cheaper than refetching per keystroke.
  useEffect(() => {
    void apiListMyRefunds({ page: 1, limit: 50 })
      .then((res) => {
        const byOrder: Record<string, RefundStatus> = {};
        // Newest first from the API; the first ticket seen for an order is
        // therefore the current one, and older closed tickets do not overwrite it.
        for (const t of res.data) {
          if (!byOrder[t.orderId]) byOrder[t.orderId] = t.status;
        }
        setRefundByOrder(byOrder);
      })
      .catch(() => setRefundByOrder({}));
  }, []);

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
          <OrderCard key={o.id} order={o} refundStatus={refundByOrder[o.id]} />
        ))}
      </ul>
    </main>
  );
}
