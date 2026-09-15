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
const ORDER_STEPS: Array<{ status: string; label: string; note: string }> = [
  { status: 'CONFIRMED', label: 'Confirmed', note: 'We have your order and your payment.' },
  { status: 'PROCESSING', label: 'Being prepared', note: 'Your order is being packed.' },
  { status: 'SHIPPED', label: 'On its way', note: 'Your order has left us.' },
  { status: 'DELIVERED', label: 'Delivered', note: 'Your order has arrived.' },
];

export default function OrderProgress({ status }: { status: string }) {
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
              <span className="mr-track-step-label">{step.label}</span>
              {reached && <span className="mr-track-step-note">{step.note}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
