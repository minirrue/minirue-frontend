/**
 * /orders/[id]/confirmation — order success page.
 *
 * Server component — fetches order detail on the server.
 * Rendered after a successful checkout POST.
 *
 * [TBD] Prices come from the Order.total field (assumed minor units / cents).
 *       If backend returns them as plain decimals, divide logic must be removed.
 * [TBD] paymentMethod field not defined in existing orders.ts spec.
 *       Inferred from checkout payload — confirm field name with backend.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { apiGetOrder } from '@/lib/api/orders';
import PriceDisplay from '@/components/storefront/PriceDisplay';

export const metadata: Metadata = {
  title: 'Order Confirmed — MiniRue',
  robots: 'noindex, nofollow',
};

/** Pass-through — amounts already decimal strings from backend. */
function minorToDisplay(amount: string | number): string {
  if (typeof amount === 'number') return amount.toFixed(2);
  return parseFloat(amount).toFixed(2);
}

export default async function OrderConfirmationPage({
  params,
}: {
  params: { id: string };
}) {
  let order;
  let fetchError: string | null = null;

  try {
    order = await apiGetOrder(params.id);
  } catch {
    fetchError = 'We could not load your order details. Your order was placed — check your email for confirmation.';
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
      <div
        style={{
          width: '100%',
          maxWidth: 640,
        }}
      >
        {/* ── Success icon ─── */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'var(--mr-st-ok-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 'var(--mr-sp-5)',
            animation: 'mr-fade-up var(--mr-dur-slow) var(--mr-ease-out) both',
          }}
        >
          <svg
            width={28}
            height={28}
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--mr-success)"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        {/* ── Heading ─── */}
        <h1
          style={{
            fontFamily: 'var(--mr-font-serif)',
            fontSize: 'var(--mr-text-2xl)',
            fontWeight: 400,
            color: 'var(--mr-fg)',
            margin: '0 0 var(--mr-sp-3)',
            letterSpacing: '-0.01em',
            animation: 'mr-fade-up var(--mr-dur-slow) var(--mr-ease-out) 80ms both',
          }}
        >
          Order Confirmed
        </h1>

        {fetchError ? (
          <div
            role="alert"
            style={{
              padding: 'var(--mr-sp-4) var(--mr-sp-5)',
              background: 'var(--mr-st-warn-bg)',
              color: 'var(--mr-st-warn-fg)',
              borderRadius: 'var(--mr-radius-md)',
              fontSize: 'var(--mr-text-sm)',
              lineHeight: 1.6,
            }}
          >
            {fetchError}
          </div>
        ) : order ? (
          <>
            <p
              style={{
                fontSize: 'var(--mr-text-sm)',
                color: 'var(--mr-fg-3)',
                margin: '0 0 var(--mr-sp-6)',
                lineHeight: 1.6,
                animation: 'mr-fade-up var(--mr-dur-slow) var(--mr-ease-out) 120ms both',
              }}
            >
              Thank you for your order. We&apos;ll send you a confirmation email shortly.
            </p>

            {/* ── Order card ─── */}
            <div
              style={{
                border: '1px solid var(--mr-border)',
                borderRadius: 'var(--mr-radius-lg)',
                overflow: 'hidden',
                background: 'var(--mr-bg-raised)',
                boxShadow: 'var(--mr-shadow-sm)',
                marginBottom: 'var(--mr-sp-6)',
                animation: 'mr-fade-up var(--mr-dur-slow) var(--mr-ease-out) 160ms both',
              }}
            >
              {/* Card header */}
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
                  <div
                    style={{
                      fontFamily: 'var(--mr-font-label)',
                      fontSize: 'var(--mr-text-xs)',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: 'var(--mr-fg-4)',
                      marginBottom: 4,
                    }}
                  >
                    Order Number
                  </div>
                  <div
                    className="mr-num"
                    style={{
                      fontFamily: 'var(--mr-font-serif)',
                      fontSize: 'var(--mr-text-xl)',
                      fontWeight: 500,
                      color: 'var(--mr-fg)',
                    }}
                  >
                    {order.orderNumber}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontFamily: 'var(--mr-font-label)',
                      fontSize: 'var(--mr-text-xs)',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: 'var(--mr-fg-4)',
                      marginBottom: 4,
                    }}
                  >
                    Placed
                  </div>
                  <div style={{ fontSize: 'var(--mr-text-sm)', color: 'var(--mr-fg-2)' }}>
                    {new Date(order.createdAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </div>
                </div>
              </div>

              {/* Items */}
              {order.items && order.items.length > 0 && (
                <div>
                  {order.items.map((item, idx) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 'var(--mr-sp-4)',
                        padding: '12px 24px',
                        borderBottom:
                          idx < order.items!.length - 1
                            ? '1px solid var(--mr-hairline)'
                            : 'none',
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 'var(--mr-text-sm)',
                            fontWeight: 500,
                            color: 'var(--mr-fg)',
                            fontFamily: 'var(--mr-font-ui)',
                          }}
                        >
                          {item.productSnapshot.name}
                        </div>
                        <div
                          style={{
                            fontSize: 'var(--mr-text-xs)',
                            color: 'var(--mr-fg-4)',
                            fontFamily: 'var(--mr-font-ui)',
                            marginTop: 2,
                          }}
                        >
                          {item.productSnapshot.brand}
                          {item.productSnapshot.sizeMl ? ` · ${item.productSnapshot.sizeMl} ml` : ''}
                          {' · Qty '}{item.qty}
                        </div>
                      </div>
                      <PriceDisplay
                        amount={minorToDisplay(item.lineTotalAmount)}
                        currency="EGP"
                        style={{ fontSize: 'var(--mr-text-sm)', flexShrink: 0 }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Totals footer */}
              <div
                style={{
                  padding: '16px 24px',
                  borderTop: '1px solid var(--mr-border)',
                  background: 'var(--mr-bg-sunken)',
                }}
              >
                {/* Payment method [TBD] — field not in spec, shown when backend includes it */}
                {(() => {
                  const pm = (order as unknown as Record<string, unknown>).paymentMethod as string | undefined;
                  if (!pm) return null;
                  return (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 'var(--mr-sp-3)',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--mr-font-ui)',
                          fontSize: 'var(--mr-text-sm)',
                          color: 'var(--mr-fg-3)',
                        }}
                      >
                        Payment
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--mr-font-label)',
                          fontSize: 'var(--mr-text-xs)',
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color: 'var(--mr-fg-2)',
                        }}
                      >
                        {pm === 'COD' ? 'Cash on Delivery' : pm}
                      </span>
                    </div>
                  );
                })()}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--mr-font-label)',
                      fontSize: 'var(--mr-text-sm)',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: 'var(--mr-fg)',
                      fontWeight: 600,
                    }}
                  >
                    Total
                  </span>
                  <PriceDisplay
                    amount={minorToDisplay(order.totalAmount)}
                    currency="EGP"
                    style={{ fontSize: 'var(--mr-text-lg)' }}
                  />
                </div>
              </div>
            </div>

            {/* ── CTA links ─── */}
            <div
              style={{
                display: 'flex',
                gap: 'var(--mr-sp-4)',
                flexWrap: 'wrap',
                animation: 'mr-fade-up var(--mr-dur-slow) var(--mr-ease-out) 200ms both',
              }}
            >
              <Link
                href={`/orders/${params.id}/track`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '12px 28px',
                  background: 'var(--mr-ink-900)',
                  color: 'var(--mr-cream-100)',
                  textDecoration: 'none',
                  fontFamily: 'var(--mr-font-label)',
                  fontSize: 'var(--mr-text-xs)',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  borderRadius: 'var(--mr-radius-pill)',
                  boxShadow: 'var(--mr-shadow-sm)',
                }}
              >
                Track Order
              </Link>

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
          </>
        ) : null}
      </div>
    </div>
  );
}
