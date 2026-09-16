import type { OrderSummary } from '@/lib/checkout/checkout-api';
import { formatMoney } from '@/lib/format/money';
import { formatDeliveryTimeRange } from '@/lib/checkout/delivery';

/**
 * Delivery method and window, on the two screens that show an order after
 * purchase: the confirmation page and the account order detail page
 * (frontend#163, backend#186).
 *
 * This is deliberately NOT `sameDayWindow()` from `lib/checkout/delivery.ts`.
 * That function answers "today or tomorrow?" from the CURRENT wall clock,
 * which is the right question at checkout — a shopper deciding whether to
 * order same-day needs to know whether the window is today's or tomorrow's,
 * right now. It is the wrong question here: this is a record of a window the
 * order already carries (`order.delivery.window.date`), and re-running
 * "today vs. tomorrow" against the read time would relabel a Monday order's
 * Tuesday window as "Today" on Tuesday and "Yesterday" (nonsensically, since
 * that value does not exist) on Wednesday. A fixed calendar date needs a
 * fixed label — the day name and the date — not a relative one that drifts
 * out from under it the moment the page is reopened.
 */

export type OrderDelivery = NonNullable<OrderSummary['delivery']>;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * 'YYYY-MM-DD' -> "Fri, 19 Sep". Built by hand from a UTC-noon `Date` rather
 * than `toLocaleDateString`: `Intl`'s weekday/month spellings and punctuation
 * (a comma vs. not, "Sep" vs. "Sept") vary by the runtime's ICU data, which
 * differs between `next dev`, a Jest run and production — a label this exact
 * cannot depend on that.
 */
export function formatDeliveryDate(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return dateISO;
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return `${WEEKDAYS[dt.getUTCDay()]}, ${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]}`;
}

/** "Fri, 19 Sep · 7 PM–12 AM" */
export function formatDeliveryWindow(window: OrderDelivery['window']): string | null {
  if (!window) return null;
  return `${formatDeliveryDate(window.date)} · ${formatDeliveryTimeRange(window.start, window.end)}`;
}

/**
 * "Same-day · fee pending" — the issue's exact acceptance-criteria copy for
 * the PENDING state, used verbatim. The SET state names the confirmed amount
 * and reminds the shopper it is paid in cash, since same-day is COD-only.
 */
export function formatSameDayFee(
  fee: OrderDelivery['sameDayFee'],
  currency: string,
): string | null {
  if (!fee) return null;
  if (fee.status === 'SET' && typeof fee.amountMinor === 'number') {
    return `Same-day · ${formatMoney((fee.amountMinor / 100).toFixed(2), currency)} · cash on delivery`;
  }
  return 'Same-day · fee pending';
}

const rowStyle: React.CSSProperties = {
  marginTop: 16,
  padding: 16,
  border: '1px solid var(--mr-border)',
  borderRadius: 'var(--mr-radius-md)',
  background: 'var(--mr-bg-raised)',
  fontSize: 'var(--mr-text-sm)',
  color: 'var(--mr-fg-2)',
};

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--mr-font-label)',
  fontSize: 'var(--mr-text-xs)',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--mr-fg-4)',
  marginBottom: 4,
};

const subStyle: React.CSSProperties = {
  fontSize: 'var(--mr-text-xs)',
  color: 'var(--mr-fg-4)',
  marginTop: 4,
};

export default function OrderDeliveryInfo({
  delivery,
  currency,
}: {
  delivery: OrderDelivery | null | undefined;
  currency: string;
}) {
  // Absent on an order placed before this shipped, or from an older backend
  // response — nothing to show, not a broken block.
  if (!delivery) return null;

  const isSameDay = delivery.method === 'SAME_DAY';
  const windowLabel = isSameDay ? formatDeliveryWindow(delivery.window) : null;
  const feeLabel = isSameDay ? formatSameDayFee(delivery.sameDayFee, currency) : null;

  return (
    <div style={rowStyle} data-trace-id="EL-ROW-order-delivery">
      <div style={labelStyle}>Delivery</div>
      <div style={{ color: 'var(--mr-fg)' }}>
        {isSameDay ? 'Same-day delivery' : 'Standard delivery'}
        {!isSameDay && delivery.etaLabel ? ` · ${delivery.etaLabel}` : ''}
      </div>
      {windowLabel && <div style={subStyle}>{windowLabel}</div>}
      {feeLabel && <div style={subStyle}>{feeLabel}</div>}
    </div>
  );
}
