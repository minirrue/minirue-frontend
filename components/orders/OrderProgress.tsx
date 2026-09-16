import type { OrderDelivery } from '@/components/orders/OrderDeliveryInfo';
import { formatDeliveryWindow, formatSameDayFee } from '@/components/orders/OrderDeliveryInfo';

/**
 * Where an order is, from its own status (#60, #125).
 *
 * MiniRue has no carrier integration and no dashboard screen creates a
 * shipment, so the order's status is the real signal. This used to live on
 * `/orders/[id]/track`, a Server Component that could never load an order; it
 * renders on the account order page now, which loads the order with the
 * shopper's session.
 *
 * It replaced a fixed sentence shown for every order, forever:
 *
 *     "Your order has been received and is being prepared for shipment.
 *      Tracking information will appear here once your order ships."
 *
 * True on the day the order is placed, and a lie once it has been delivered or
 * cancelled.
 */
const ORDER_STEPS: Array<{ status: string; label: string; currentLabel?: string; note: string }> = [
  // While it is the current (yellow) step it is still happening, so it reads
  // "Confirming"; once a later step is reached it is done: "Confirmed" (owner).
  { status: 'CONFIRMED', label: 'Confirmed', currentLabel: 'Confirming', note: 'We have your order and your payment.' },
  { status: 'PROCESSING', label: 'Being prepared', note: 'Your order is being packed.' },
  { status: 'SHIPPED', label: 'On its way', note: 'Your order has left us.' },
  { status: 'DELIVERED', label: 'Delivered', note: 'Your order has arrived.' },
];

/**
 * The delivery method/window/fee lines, coordinator request 2026-09-15: shown
 * INSIDE the "On its way" (SHIPPED) step's block — not only in the separate
 * `OrderDeliveryInfo` card below the tracker — so the shopper sees the ETA
 * from the moment the page loads, before the order has actually shipped.
 * Deliberately rendered regardless of whether that step is `reached`: an ETA
 * is useful from CONFIRMED onward, not only once the parcel is on its way.
 */
function ShippedStepDelivery({ delivery, currency }: { delivery: OrderDelivery; currency: string }) {
  const isSameDay = delivery.method === 'SAME_DAY';
  const windowLabel = isSameDay ? formatDeliveryWindow(delivery.window) : null;
  const feeLabel = isSameDay ? formatSameDayFee(delivery.sameDayFee, currency) : null;

  return (
    <div className="mr-track-step-delivery" data-trace-id="EL-ROW-track-step-delivery">
      <div>Delivery</div>
      <div>Method: {isSameDay ? 'Same-day' : 'Standard'}</div>
      {!isSameDay && delivery.etaLabel && <div>ETA: {delivery.etaLabel}</div>}
      {isSameDay && windowLabel && <div>Window: {windowLabel}</div>}
      {isSameDay && feeLabel && <div>{feeLabel}</div>}
    </div>
  );
}

export default function OrderProgress({
  status,
  delivery,
  currency = 'EGP',
}: {
  status: string;
  /** Absent on an order placed before frontend#163 shipped, or an older backend response. */
  delivery?: OrderDelivery | null;
  currency?: string;
}) {
  if (status === 'CANCELLED' || status === 'REFUNDED') {
    return (
      <div className="mr-track-empty" data-tone="danger">
        This order was {status === 'CANCELLED' ? 'cancelled' : 'refunded'}.
        There is nothing on its way.
      </div>
    );
  }

  // PENDING (e.g. a payment still being checked) reaches no step: -1.
  const reachedIndex = ORDER_STEPS.findIndex((s) => s.status === status);

  return (
    <ol className="mr-track-steps" aria-label="Order progress">
      {ORDER_STEPS.map((step, i) => {
        const reached = reachedIndex >= i;
        // Delivered is the end, not a step in progress: it shows as done (#159).
        const current = reachedIndex === i && step.status !== 'DELIVERED';
        return (
          <li
            key={step.status}
            className="mr-track-step"
            data-reached={reached ? 'true' : 'false'}
            data-current={current ? 'true' : 'false'}
            // aria-current rather than colour alone: a screen reader has to be
            // able to answer "where is my order" without the visual treatment.
            aria-current={current ? 'step' : undefined}
          >
            <span className="mr-track-step-dot" aria-hidden="true" />
            <span className="mr-track-step-body">
              <span className="mr-track-step-label">{current ? (step.currentLabel ?? step.label) : step.label}</span>
              {reached && <span className="mr-track-step-note">{step.note}</span>}
              {step.status === 'SHIPPED' && delivery && (
                <ShippedStepDelivery delivery={delivery} currency={currency} />
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
