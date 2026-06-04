/**
 * Order Detail page — server component
 * [TBD] Order detail API (items, statusHistory) not defined in customers spec.
 *       Shape inferred from orders module data model. Confirm with backend team.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { apiGetOrder, type OrderStatus } from '@/lib/api/orders';
import CancelButton from './CancelButton';

export const metadata: Metadata = { title: 'Order Detail — My Account — MiniRue' };

const CANCELLABLE: OrderStatus[] = ['PENDING', 'CONFIRMED'];
const REFUNDABLE: OrderStatus[] = ['DELIVERED'];

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let order;
  let fetchError: string | null = null;

  try {
    order = await apiGetOrder(id);
  } catch {
    fetchError = 'Unable to load order. Please go back and try again.';
  }

  return (
    <>
      {/* Back link */}
      <Link
        href="/account/orders"
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
          marginBottom: 24,
        }}
      >
        ← Orders
      </Link>

      {fetchError && (
        <p role="alert" style={{ color: 'var(--mr-danger)', fontSize: 'var(--mr-text-sm)' }}>
          {fetchError}
        </p>
      )}

      {order && (
        <>
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 32,
            }}
          >
            <div>
              <h1
                style={{
                  fontFamily: 'var(--mr-font-label)',
                  fontSize: 'var(--mr-text-xl)',
                  fontWeight: 600,
                  margin: '0 0 6px',
                  color: 'var(--mr-fg)',
                }}
              >
                {order.orderNumber}
              </h1>
              <p style={{ margin: 0, fontSize: 'var(--mr-text-sm)', color: 'var(--mr-fg-3)' }}>
                Placed{' '}
                {new Date(order.createdAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {CANCELLABLE.includes(order.status) && (
                <CancelButton orderId={String(order.id)} />
              )}
              {REFUNDABLE.includes(order.status) && (
                <Link
                  href={`/account/orders/${id}/refund`}
                  style={{
                    padding: '8px 20px',
                    background: 'none',
                    border: '1px solid var(--mr-border)',
                    borderRadius: 'var(--mr-radius-pill)',
                    fontFamily: 'var(--mr-font-label)',
                    fontSize: 'var(--mr-text-xs)',
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--mr-fg-2)',
                    textDecoration: 'none',
                  }}
                >
                  Request Refund
                </Link>
              )}
            </div>
          </div>

          {/* Order items */}
          {order.items && order.items.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <h2
                style={{
                  fontFamily: 'var(--mr-font-label)',
                  fontSize: 'var(--mr-text-sm)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--mr-fg-4)',
                  fontWeight: 500,
                  margin: '0 0 14px',
                }}
              >
                Items
              </h2>
              <div
                style={{
                  border: '1px solid var(--mr-border)',
                  borderRadius: 'var(--mr-radius-md)',
                  overflow: 'hidden',
                }}
              >
                {order.items.map((item, idx) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr 1fr',
                      gap: 16,
                      padding: '14px 18px',
                      borderBottom:
                        idx < order.items!.length - 1 ? '1px solid var(--mr-hairline)' : 'none',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 'var(--mr-text-sm)', color: 'var(--mr-fg)' }}>
                        {item.productSnapshot.name}
                      </div>
                      <div style={{ fontSize: 'var(--mr-text-xs)', color: 'var(--mr-fg-4)' }}>
                        {item.productSnapshot.brand}
                        {item.productSnapshot.sizeMl ? ` · ${item.productSnapshot.sizeMl} ml` : ''}
                      </div>
                    </div>
                    <div style={{ fontSize: 'var(--mr-text-sm)', color: 'var(--mr-fg-3)' }}>
                      Qty: {item.qty}
                    </div>
                    <div style={{ fontSize: 'var(--mr-text-sm)', color: 'var(--mr-fg-3)' }}>
                      {item.unitPriceCurrency} {parseFloat(item.unitPriceAmount).toLocaleString('en-EG', { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: 'var(--mr-text-sm)', fontWeight: 500, color: 'var(--mr-fg)', textAlign: 'right' }}>
                      {item.unitPriceCurrency} {parseFloat(item.lineTotalAmount).toLocaleString('en-EG', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}

                {/* Total row */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    padding: '12px 18px',
                    borderTop: '1px solid var(--mr-border)',
                    background: 'var(--mr-bg-sunken)',
                    gap: 24,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--mr-font-label)',
                      fontSize: 'var(--mr-text-xs)',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: 'var(--mr-fg-4)',
                    }}
                  >
                    Total
                  </span>
                  <span
                    style={{
                      fontSize: 'var(--mr-text-sm)',
                      fontWeight: 600,
                      color: 'var(--mr-fg)',
                    }}
                  >
                    {order.totalCurrency} {parseFloat(order.totalAmount).toLocaleString('en-EG', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* Status timeline */}
          {order.statusHistory && order.statusHistory.length > 0 && (
            <section>
              <h2
                style={{
                  fontFamily: 'var(--mr-font-label)',
                  fontSize: 'var(--mr-text-sm)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--mr-fg-4)',
                  fontWeight: 500,
                  margin: '0 0 14px',
                }}
              >
                Status History
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {order.statusHistory.map((event, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      gap: 16,
                      alignItems: 'flex-start',
                    }}
                  >
                    {/* Timeline dot + line */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background:
                            idx === 0 ? 'var(--mr-accent)' : 'var(--mr-border)',
                          marginTop: 4,
                        }}
                      />
                      {idx < order.statusHistory!.length - 1 && (
                        <div
                          style={{
                            width: 1,
                            flex: 1,
                            minHeight: 24,
                            background: 'var(--mr-hairline)',
                          }}
                        />
                      )}
                    </div>

                    {/* Event text */}
                    <div style={{ paddingBottom: 20 }}>
                      <div
                        style={{
                          fontFamily: 'var(--mr-font-label)',
                          fontSize: 'var(--mr-text-xs)',
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color: idx === 0 ? 'var(--mr-fg)' : 'var(--mr-fg-3)',
                          fontWeight: idx === 0 ? 600 : 400,
                        }}
                      >
                        {STATUS_LABELS[event.toStatus as OrderStatus] ?? event.toStatus}
                      </div>
                      <div style={{ fontSize: 'var(--mr-text-xs)', color: 'var(--mr-fg-4)' }}>
                        {new Date(event.createdAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                      {event.reason && (
                        <div style={{ fontSize: 'var(--mr-text-xs)', color: 'var(--mr-fg-3)', marginTop: 2 }}>
                          {event.reason}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
