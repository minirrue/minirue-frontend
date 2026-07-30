/**
 * Unit tests — app/account/orders/OrderHistoryClient.tsx
 * Covers: the refunded-amount line added for W1.5. A separate file from
 * order-history-client.test.tsx (not edited here) so that suite's existing
 * assertions stay untouched.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockApiListOrders = jest.fn();
jest.mock('@/lib/checkout/checkout-api', () => ({
  apiListOrders: (...args: unknown[]) => mockApiListOrders(...args),
}));

// ── Component ────────────────────────────────────────────────────────────────
import OrderHistoryClient from '@/app/account/orders/OrderHistoryClient';

const order = (overrides: Record<string, unknown> = {}) => ({
  id: 'o1',
  orderNumber: 'MR-0001',
  orderSeq: 47,
  status: 'REFUNDED',
  totalAmount: '450.00',
  totalCurrency: 'EGP',
  items: [],
  createdAt: '2026-07-25T00:00:00.000Z',
  refundedAt: '2026-07-29T00:00:00.000Z',
  refundedAmountCents: 45000,
  ...overrides,
});

describe('OrderHistoryClient — refunded amount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the refunded amount when refundedAmountCents is set', async () => {
    mockApiListOrders.mockResolvedValue({ data: [order()], total: 1, page: 1, limit: 10 });
    render(<OrderHistoryClient />);

    await waitFor(() => expect(screen.getByText('#47')).toBeInTheDocument());
    expect(screen.getByText(/EGP 450\.00 refunded/)).toBeInTheDocument();
  });

  it('renders no refund text for an order that was never refunded', async () => {
    mockApiListOrders.mockResolvedValue({
      data: [
        order({
          id: 'o2',
          status: 'DELIVERED',
          refundedAt: null,
          refundedAmountCents: null,
        }),
      ],
      total: 1,
      page: 1,
      limit: 10,
    });
    render(<OrderHistoryClient />);

    await waitFor(() => expect(screen.getByText('#47')).toBeInTheDocument());
    expect(screen.queryByText(/refunded/i)).not.toBeInTheDocument();
  });
});
