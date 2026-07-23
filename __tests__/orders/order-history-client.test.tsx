/**
 * Unit tests — app/account/orders/OrderHistoryClient.tsx
 * Covers: debounced order-number search issuing one request with `q`,
 *         #N ref rendering (including orderSeq === 0), and the
 *         term-naming empty state.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockApiListOrders = jest.fn();
jest.mock('@/lib/checkout/checkout-api', () => ({
  apiListOrders: (...args: unknown[]) => mockApiListOrders(...args),
}));

// ── Component ────────────────────────────────────────────────────────────────
import OrderHistoryClient from '@/app/account/orders/OrderHistoryClient';

const order = (overrides: Partial<{
  id: string;
  orderNumber: string;
  orderSeq: number;
  totalAmount: string;
  totalCurrency: string;
}> = {}) => ({
  id: 'o1',
  orderNumber: 'MR-0001',
  orderSeq: 47,
  status: 'CONFIRMED',
  totalAmount: '100.00',
  totalCurrency: 'EGP',
  items: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('OrderHistoryClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ legacyFakeTimers: false });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders an order with its #N ref beside the order number', async () => {
    mockApiListOrders.mockResolvedValue({ data: [order()], total: 1, page: 1, limit: 10 });
    render(<OrderHistoryClient />);

    await waitFor(() => expect(screen.getByText('#47')).toBeInTheDocument());
    expect(screen.getByText('MR-0001')).toBeInTheDocument();
  });

  it('renders orderSeq 0 as #0, not blank', async () => {
    mockApiListOrders.mockResolvedValue({
      data: [order({ orderSeq: 0, id: 'o0', orderNumber: 'MR-0000' })],
      total: 1,
      page: 1,
      limit: 10,
    });
    render(<OrderHistoryClient />);

    await waitFor(() => expect(screen.getByText('#0')).toBeInTheDocument());
  });

  it('debounces the search input, issuing one request carrying q', async () => {
    mockApiListOrders.mockResolvedValue({ data: [], total: 0, page: 1, limit: 10 });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<OrderHistoryClient />);

    await waitFor(() => expect(mockApiListOrders).toHaveBeenCalledTimes(1));
    mockApiListOrders.mockClear();

    const input = screen.getByLabelText(/search your orders by order number/i);
    await user.type(input, '47');

    // Not yet debounced.
    expect(mockApiListOrders).not.toHaveBeenCalled();

    await waitFor(() => {
      jest.advanceTimersByTime(300);
      expect(mockApiListOrders).toHaveBeenCalledTimes(1);
    });
    expect(mockApiListOrders).toHaveBeenCalledWith(1, 10, '47');
  });

  it('names the searched term when no order matches', async () => {
    mockApiListOrders
      .mockResolvedValueOnce({ data: [order()], total: 1, page: 1, limit: 10 })
      .mockResolvedValueOnce({ data: [], total: 0, page: 1, limit: 10 });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<OrderHistoryClient />);
    await waitFor(() => expect(screen.getByText('#47')).toBeInTheDocument());

    const input = screen.getByLabelText(/search your orders by order number/i);
    await user.type(input, '999');

    await waitFor(() => {
      jest.advanceTimersByTime(300);
      expect(screen.getByText('No order matches "999".')).toBeInTheDocument();
    });
  });
});
