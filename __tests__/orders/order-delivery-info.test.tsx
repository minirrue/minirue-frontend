import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import OrderDeliveryInfo, {
  formatDeliveryDate,
  formatDeliveryWindow,
  formatSameDayFee,
} from '@/components/orders/OrderDeliveryInfo';
import type { OrderSummary } from '@/lib/checkout/checkout-api';

/**
 * frontend#163 — delivery method/window/fee status on the order pages
 * (post-purchase). Confirmation page and account order detail both render
 * this same block, so it is pinned once here rather than duplicated per
 * screen.
 */

describe('formatDeliveryDate / formatDeliveryWindow', () => {
  it('formats a fixed calendar date as weekday + day + month, never relative to now', () => {
    // A Sunday, regardless of when this test runs.
    expect(formatDeliveryDate('2026-09-20')).toBe('Sun, 20 Sep');
  });

  it('joins the date with the start/end window', () => {
    expect(formatDeliveryWindow({ date: '2026-09-20', start: '19:00', end: '24:00' })).toBe(
      'Sun, 20 Sep · 19:00–24:00',
    );
  });

  it('returns null for a null window', () => {
    expect(formatDeliveryWindow(null)).toBeNull();
  });
});

// `Intl.NumberFormat` (via `formatMoney`) separates the currency code from the
// amount with a non-breaking space, not " " — matched literally here rather
// than normalised, the same way __tests__/orders/order-screens-sets.test.tsx
// does for the same reason.
const plain = (s: string) => s.replace(/ /g, ' ');

describe('formatSameDayFee', () => {
  it('is the exact acceptance-criteria copy while pending', () => {
    expect(formatSameDayFee({ status: 'PENDING', amountMinor: null }, 'EGP')).toBe(
      'Same-day · fee pending',
    );
  });

  it('names the confirmed amount once set', () => {
    expect(plain(formatSameDayFee({ status: 'SET', amountMinor: 12000 }, 'EGP')!)).toBe(
      'Same-day · EGP 120 · cash on delivery',
    );
  });

  it('returns null when there is no fee block at all', () => {
    expect(formatSameDayFee(null, 'EGP')).toBeNull();
  });
});

const BASE_ORDER = {
  id: 'o1',
  orderNumber: 'MR-20260915-00001',
  orderSeq: 1,
  status: 'CONFIRMED',
  totalAmount: '450.0000',
  totalCurrency: 'EGP',
  items: [],
  createdAt: '2026-09-15T10:00:00.000Z',
  refundedAt: null,
  refundedAmountCents: null,
} satisfies Omit<OrderSummary, 'delivery'>;

describe('OrderDeliveryInfo', () => {
  it('renders nothing when the order has no delivery block (older order/backend)', () => {
    const { container } = render(<OrderDeliveryInfo delivery={undefined} currency="EGP" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows STANDARD with its eta label', () => {
    render(
      <OrderDeliveryInfo
        delivery={{
          method: 'STANDARD',
          etaLabel: '2–5 working days',
          window: null,
          location: null,
          sameDayFee: null,
        }}
        currency="EGP"
      />,
    );
    expect(screen.getByText(/Standard delivery/)).toBeInTheDocument();
    expect(screen.getByText(/2–5 working days/)).toBeInTheDocument();
  });

  it('a Cairo SAME_DAY order shows the window and "fee pending"', () => {
    render(
      <OrderDeliveryInfo
        delivery={{
          method: 'SAME_DAY',
          etaLabel: null,
          window: { date: '2026-09-16', start: '19:00', end: '24:00' },
          location: { lat: 30.0444, lng: 31.2357 },
          sameDayFee: { status: 'PENDING', amountMinor: null },
        }}
        currency="EGP"
      />,
    );
    expect(screen.getByText(/Same-day delivery/)).toBeInTheDocument();
    expect(screen.getByText(/19:00–24:00/)).toBeInTheDocument();
    expect(screen.getByText('Same-day · fee pending')).toBeInTheDocument();
  });

  it('a SET-fee SAME_DAY order shows the confirmed amount', () => {
    render(
      <OrderDeliveryInfo
        delivery={{
          method: 'SAME_DAY',
          etaLabel: null,
          window: { date: '2026-09-16', start: '19:00', end: '24:00' },
          location: { mapsUrl: 'https://maps.google.com/?q=30,31' },
          sameDayFee: { status: 'SET', amountMinor: 13500 },
        }}
        currency="EGP"
      />,
    );
    expect(screen.getByText(/EGP\s*135\s*·\s*cash on delivery/)).toBeInTheDocument();
  });
});

// Integration: the order detail page wires `order.delivery` straight through.
const mockApiGetOrder = jest.fn();
jest.mock('@/lib/checkout/checkout-api', () => ({
  apiGetOrder: (...args: unknown[]) => mockApiGetOrder(...args),
}));
jest.mock('@/lib/api/refunds', () => ({
  apiListMyRefunds: () => Promise.resolve({ data: [] }),
}));
jest.mock('next/navigation', () => ({ useParams: () => ({ id: 'o1' }) }));

import OrderDetailClient from '@/app/account/orders/[id]/OrderDetailClient';

describe('OrderDetailClient delivery block', () => {
  it('shows a STANDARD order’s eta label', async () => {
    mockApiGetOrder.mockResolvedValue({
      ...BASE_ORDER,
      delivery: { method: 'STANDARD', etaLabel: '2–5 working days', window: null, location: null, sameDayFee: null },
    });
    render(<OrderDetailClient />);
    await waitFor(() => expect(screen.getByText(/2–5 working days/)).toBeInTheDocument());
  });
});
