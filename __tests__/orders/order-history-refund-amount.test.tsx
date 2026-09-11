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
    // "EGP 450", not "EGP 450.00" — one money rule for the whole site now
    // (#1, lib/format/money.ts). A card priced "EGP 450" and a refund line
    // reading "EGP 450.00" for the same order read as two different numbers.
    expect(screen.getByText(/EGP 450 refunded/)).toBeInTheDocument();
  });

  it('keeps the piastres on a part refund', async () => {
    // The other half of the same rule: decimals are dropped only when they are
    // zero. A refund of 450.50 must not be reported as 450 or as 451.
    mockApiListOrders.mockResolvedValue({
      data: [order({ refundedAmountCents: 45050 })],
      total: 1,
      page: 1,
      limit: 10,
    });
    render(<OrderHistoryClient />);

    await waitFor(() => expect(screen.getByText('#47')).toBeInTheDocument());
    expect(screen.getByText(/EGP 450\.50 refunded/)).toBeInTheDocument();
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
