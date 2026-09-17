import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { OrderSummary } from '@/lib/checkout/checkout-api';

const push = jest.fn();
const loadRebuyPlan = jest.fn();
const executeRebuyPlan = jest.fn();
const saveRebuyResult = jest.fn();

jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
jest.mock('@/components/storefront/cart/CartContext', () => ({
  useCart: () => ({ items: [], loading: false }),
}));
jest.mock('@/lib/orders/rebuy', () => ({
  loadRebuyPlan: (...args: unknown[]) => loadRebuyPlan(...args),
  executeRebuyPlan: (...args: unknown[]) => executeRebuyPlan(...args),
  saveRebuyResult: (...args: unknown[]) => saveRebuyResult(...args),
}));

import PaymentRejectionPanel, { rejectionMessage } from '@/components/orders/PaymentRejectionPanel';

const ORDER: OrderSummary = {
  id: 'order-1',
  orderNumber: 'MR-001',
  orderSeq: 1,
  status: 'PENDING',
  totalAmount: '100.00',
  totalCurrency: 'EGP',
  items: [],
  createdAt: '2026-09-17T00:00:00.000Z',
  refundedAt: null,
  refundedAmountCents: null,
  paymentRejection: { reason: 'AMOUNT_MISMATCH', note: 'Received EGP 90.' },
};

describe('PaymentRejectionPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadRebuyPlan.mockResolvedValue({ actions: [], issues: [] });
    executeRebuyPlan.mockResolvedValue({ addedLines: 0, addedQty: 0, issues: [] });
  });

  it('has friendly copy for every backend reason', () => {
    const reasons = [
      'RECEIPT_UNREADABLE',
      'AMOUNT_MISMATCH',
      'REFERENCE_NOT_FOUND',
      'DUPLICATE_RECEIPT',
      'SENDER_NAME_MISMATCH',
      'OTHER',
    ] as const;
    for (const reason of reasons) expect(rejectionMessage(reason)).toMatch(/\.$/);
  });

  it('shows the safe reviewer note and takes a real click through to the cart', async () => {
    render(<PaymentRejectionPanel order={ORDER} />);

    expect(screen.getByRole('heading', { name: /payment needs attention/i })).toBeInTheDocument();
    expect(screen.getByText(/received egp 90/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /buy this order again/i }));

    await waitFor(() => expect(loadRebuyPlan).toHaveBeenCalledWith([], []));
    expect(executeRebuyPlan).toHaveBeenCalled();
    expect(saveRebuyResult).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/cart?rebuy=1');
  });

  it('keeps the shopper on the order when availability cannot be checked', async () => {
    loadRebuyPlan.mockRejectedValue(new Error('offline'));
    render(<PaymentRejectionPanel order={ORDER} />);
    fireEvent.click(screen.getByRole('button', { name: /buy this order again/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent("couldn't check today's stock");
    expect(push).not.toHaveBeenCalled();
  });
});
