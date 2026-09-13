import type { Metadata } from 'next';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { apiGetOrder, type Order, type OrderStatus } from '@/lib/api/orders';
import { apiFetch } from '@/lib/api/client';

export const metadata: Metadata = {
  title: 'Track Order — MiniRue',
  robots: 'noindex, nofollow',
};

type ShipmentStatus =
  | 'CREATED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'FAILED_ATTEMPT'
  | 'RETURNED';

interface TrackingEvent {
  id: string;
  status: ShipmentStatus;
  location: string | null;
  note: string | null;
  occurredAt: string;
}

interface Shipment {
  id: string;
  orderId: string;
  status: ShipmentStatus;
  courierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  estimatedDeliveryAt: string | null;
  deliveredAt: string | null;
  events: TrackingEvent[];
}

const STATUS_LABELS: Record<ShipmentStatus, string> = {
  CREATED: 'Label Created',
  PICKED_UP: 'Picked Up',
  IN_TRANSIT: 'In Transit',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  FAILED_ATTEMPT: 'Delivery Attempted',
  RETURNED: 'Returned to Sender',
};


/**
 * What the shop can actually tell a customer today.
 *
 * MiniRue has no carrier integration — the dashboard's Shipping service panel
 * says so in as many words, and every control on it is disabled. So no
 * `fulfillment_shipments` row is ever created, and this page's carrier view is
 * for a future that has not arrived.
 *
 * It used to say, for every order forever:
 *
 *     "Your order has been received and is being prepared for shipment.
 *      Tracking information will appear here once your order ships."
 *
 * Which is true on the day the order is placed and a lie once it has been
 * delivered. The order's OWN status is the real signal and was already fetched
 * on this page — used for nothing but printing the order number (#60).
 *
 * So this renders that instead: the four states an order actually moves
 * through, with the reached ones marked. When a carrier is signed the shipment
 * view above takes over and this becomes the fallback it was always meant to
 * be.
 */
const ORDER_STEPS: Array<{ status: OrderStatus; label: string; note: string }> = [
  { status: 'CONFIRMED', label: 'Confirmed', note: 'We have your order and your payment.' },
  { status: 'PROCESSING', label: 'Being prepared', note: 'Your order is being packed.' },
  { status: 'SHIPPED', label: 'On its way', note: 'Your order has left us.' },
  { status: 'DELIVERED', label: 'Delivered', note: 'Your order has arrived.' },
];

function OrderProgress({ order }: { order: Order | null }) {
  // No order either — the id is wrong, or it is not this customer's. Say the
  // honest thing rather than implying a parcel exists.
  if (!order) {
    return (
      <div className="mr-track-empty">
        We could not find that order. Check the link, or open it from your
        account.
      </div>
    );
  }

  if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
    return (
      <div className="mr-track-empty">
        This order was {order.status === 'CANCELLED' ? 'cancelled' : 'refunded'}.
        There is nothing on its way.
      </div>
    );
  }

  const reachedIndex = ORDER_STEPS.findIndex((s) => s.status === order.status);

  return (
    <ol className="mr-track-steps" aria-label="Order progress">
      {ORDER_STEPS.map((step, i) => {
        const reached = reachedIndex >= i;
        const current = reachedIndex === i;
        return (
          <li
            key={step.status}
            className="mr-track-step"
            data-reached={reached ? 'true' : 'false'}
            data-current={current ? 'true' : 'false'}
            /*
             * aria-current rather than colour alone. The whole point of this
             * list is "where is my order", and a screen reader has to be able
             * to answer that without the visual treatment.
             */
            aria-current={current ? 'step' : undefined}
          >
            <span className="mr-track-step-dot" aria-hidden="true" />
            <span className="mr-track-step-body">
              <span className="mr-track-step-label">{step.label}</span>
              {reached && (
                <span className="mr-track-step-note">{step.note}</span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default async function TrackOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let shipment: Shipment | null = null;
  let order = null;

  try {
    order = await apiGetOrder(id);
  } catch { /* non-critical */ }

  try {
    shipment = await apiFetch<Shipment>(
      `/fulfillment/shipments/order/${id}`,
      { auth: true },
    );
  } catch {
    shipment = null;
  }

  return (
    <div
      style={{
        // dvh tracks iOS Safari's actual visible viewport as its toolbar collapses/expands;
        // plain vh resized this full-page state mid-scroll.
        minHeight: '100svh',
        background: 'var(--mr-bg)',
        fontFamily: 'var(--mr-font-ui)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 'var(--mr-sp-8) var(--mr-gutter)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 600 }}>
        <Link
          href={`/account/orders/${id}`}
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
          ← Order Details
        </Link>

        <h1
          style={{
            fontFamily: 'var(--mr-font-serif)',
            fontSize: 'var(--mr-text-2xl)',
            fontWeight: 400,
            color: 'var(--mr-fg)',
            margin: '0 0 var(--mr-sp-6)',
            letterSpacing: '-0.01em',
          }}
        >
          Track Order
        </h1>

        {order && (
          <p style={{ fontSize: 'var(--mr-text-sm)', color: 'var(--mr-fg-3)', margin: '0 0 var(--mr-sp-5)' }}>
            Order {order.orderNumber}
          </p>
        )}

        {!shipment && <OrderProgress order={order} />}

        {shipment && (
          <div
            style={{
              border: '1px solid var(--mr-border)',
              borderRadius: 'var(--mr-radius-lg)',
              overflow: 'hidden',
              background: 'var(--mr-bg-raised)',
              boxShadow: 'var(--mr-shadow-sm)',
            }}
          >
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--mr-hairline)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 'var(--mr-sp-3)',
              }}
            >
              <div>
                <div style={{ fontFamily: 'var(--mr-font-label)', fontSize: 'var(--mr-text-xs)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mr-fg-4)', marginBottom: 4 }}>
                  Status
                </div>
                <div style={{ fontSize: 'var(--mr-text-sm)', fontWeight: 500, color: 'var(--mr-fg)' }}>
                  {STATUS_LABELS[shipment.status]}
                </div>
              </div>
              {shipment.courierName && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--mr-font-label)', fontSize: 'var(--mr-text-xs)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mr-fg-4)', marginBottom: 4 }}>
                    Carrier
                  </div>
                  <div style={{ fontSize: 'var(--mr-text-sm)', color: 'var(--mr-fg-2)' }}>{shipment.courierName}</div>
                </div>
              )}
            </div>

            {shipment.trackingNumber && (
              <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--mr-hairline)' }}>
                <div style={{ fontFamily: 'var(--mr-font-label)', fontSize: 'var(--mr-text-xs)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mr-fg-4)' }}>
                  Tracking Number
                </div>
                <div style={{ marginTop: 4 }}>
                  {shipment.trackingUrl ? (
                    <a href={shipment.trackingUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 'var(--mr-text-sm)', color: 'var(--mr-accent)', fontFamily: 'var(--mr-font-label)' }}>
                      {shipment.trackingNumber}
                    </a>
                  ) : (
                    <code style={{ fontSize: 'var(--mr-text-sm)', color: 'var(--mr-fg)' }}>{shipment.trackingNumber}</code>
                  )}
                </div>
              </div>
            )}

            {shipment.events && shipment.events.length > 0 && (
              <div style={{ padding: '16px 24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {[...shipment.events].reverse().map((event, idx, arr) => (
                    <div key={event.id} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: idx === 0 ? 'var(--mr-accent)' : 'var(--mr-border)', marginTop: 4 }} />
                        {idx < arr.length - 1 && <div style={{ width: 1, flex: 1, minHeight: 24, background: 'var(--mr-hairline)' }} />}
                      </div>
                      <div style={{ paddingBottom: 20 }}>
                        <div style={{ fontFamily: 'var(--mr-font-label)', fontSize: 'var(--mr-text-xs)', letterSpacing: '0.08em', textTransform: 'uppercase', color: idx === 0 ? 'var(--mr-fg)' : 'var(--mr-fg-3)', fontWeight: idx === 0 ? 600 : 400 }}>
                          {STATUS_LABELS[event.status] ?? event.status}
                        </div>
                        {event.location && <div style={{ fontSize: 'var(--mr-text-xs)', color: 'var(--mr-fg-3)', marginTop: 2 }}>{event.location}</div>}
                        <div style={{ fontSize: 'var(--mr-text-xs)', color: 'var(--mr-fg-4)', marginTop: 2 }}>
                          {new Date(event.occurredAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {event.note && <div style={{ fontSize: 'var(--mr-text-xs)', color: 'var(--mr-fg-3)', marginTop: 2 }}>{event.note}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 'var(--mr-sp-6)' }}>
          <Button variant="outline" href="/shop/all">
            Continue Shopping
          </Button>
        </div>
      </div>
    </div>
  );
}
