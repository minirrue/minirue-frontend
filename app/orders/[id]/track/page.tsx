import type { Metadata } from 'next';
import Link from 'next/link';
import { apiGetOrder } from '@/lib/api/orders';
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

export default async function TrackOrderPage({
  params,
}: {
  params: { id: string };
}) {
  let shipment: Shipment | null = null;
  let order = null;

  try {
    order = await apiGetOrder(params.id);
  } catch { /* non-critical */ }

  try {
    shipment = await apiFetch<Shipment>(
      `/fulfillment/shipments/order/${params.id}`,
      { auth: true },
    );
  } catch {
    shipment = null;
  }

  return (
    <div
      style={{
        minHeight: '100vh',
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
          href={`/account/orders/${params.id}`}
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

        {!shipment && (
          <div
            style={{
              padding: 'var(--mr-sp-5)',
              background: 'var(--mr-bg-raised)',
              border: '1px solid var(--mr-border)',
              borderRadius: 'var(--mr-radius-md)',
              fontSize: 'var(--mr-text-sm)',
              color: 'var(--mr-fg-3)',
            }}
          >
            Your order has been received and is being prepared for shipment.
            Tracking information will appear here once your order ships.
          </div>
        )}

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
          <Link
            href="/products"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '12px 28px',
              background: 'none',
              border: '1px solid var(--mr-border)',
              color: 'var(--mr-fg-2)',
              textDecoration: 'none',
              fontFamily: 'var(--mr-font-label)',
              fontSize: 'var(--mr-text-xs)',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              borderRadius: 'var(--mr-radius-pill)',
            }}
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
