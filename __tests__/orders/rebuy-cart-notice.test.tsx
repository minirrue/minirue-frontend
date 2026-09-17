import React from 'react';
import { render, screen, within } from '@testing-library/react';
import RebuyCartNotice from '@/components/orders/RebuyCartNotice';
import { saveRebuyResult } from '@/lib/orders/rebuy';

describe('RebuyCartNotice', () => {
  beforeEach(() => sessionStorage.clear());

  it('confirms a complete repeat order', async () => {
    saveRebuyResult({ addedLines: 2, addedQty: 3, issues: [] });
    render(<RebuyCartNotice />);
    expect(await screen.findByRole('status')).toHaveTextContent('previous order is back in your bag');
  });

  it('names adjusted and unavailable lines for a partial result', async () => {
    saveRebuyResult({
      addedLines: 1,
      addedQty: 2,
      issues: [
        { name: 'Rose', kind: 'quantity-adjusted', requestedQty: 4, addedQty: 2 },
        { name: 'Musk', kind: 'unavailable', requestedQty: 1, addedQty: 0 },
      ],
    });
    render(<RebuyCartNotice />);
    const notice = await screen.findByRole('status');
    expect(within(notice).getByText(/Rose: added 2 of 4/)).toBeInTheDocument();
    expect(within(notice).getByText(/Musk is currently unavailable/)).toBeInTheDocument();
  });

  it('explains when no prior item could be added', async () => {
    saveRebuyResult({
      addedLines: 0,
      addedQty: 0,
      issues: [{ name: 'Rose', kind: 'unavailable', requestedQty: 1, addedQty: 0 }],
    });
    render(<RebuyCartNotice />);
    expect(await screen.findByRole('status')).toHaveTextContent('None of those items are available');
  });
});
