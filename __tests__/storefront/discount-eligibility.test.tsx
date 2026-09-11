import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { SitewideDiscountProvider, useDiscountedPrice } from '@/lib/hooks/use-sitewide-discount';

// The provider fetches the live percentage on mount; this decides what it gets.
let mockPercent: number | null = null;
jest.mock('@/lib/api/client', () => ({
  apiFetch: jest.fn(async () => ({ percent: mockPercent })),
}));

/**
 * A price shown is a price charged.
 *
 * #3: a sitewide markdown struck prices through on the storefront that checkout
 * then charged in full, because the two sides used different rules for who
 * qualifies:
 *
 *   backend   product has no collaborator AND its brand has none
 *   storefront `!product.collaboratorId` — the product only
 *
 * On top of that `useDiscountedPrice`'s `isMinirueOwned` defaulted to `true`,
 * so any caller that omitted it discounted unconditionally.
 *
 * The API now returns `isMinirueOwned` and the argument is required, so a
 * caller cannot fall into the unsafe answer by forgetting it. These tests pin
 * the behaviour that matters: eligible prices are cut, ineligible ones are not,
 * and "unknown" resolves to full price.
 */

function Price({
  amount,
  eligible,
}: {
  amount: string;
  eligible: boolean;
}) {
  const shown = useDiscountedPrice(amount, eligible);
  return (
    <div>
      <span data-testid="shown">{shown.amount}</span>
      <span data-testid="was">{shown.wasAmount ?? ''}</span>
    </div>
  );
}

async function renderAt(
  percent: number | null,
  eligible: boolean,
  amount = '100.00',
) {
  mockPercent = percent;
  const view = render(
    <SitewideDiscountProvider>
      <Price amount={amount} eligible={eligible} />
    </SitewideDiscountProvider>,
  );
  // The percentage arrives in an effect, so wait for the first paint that has it
  // (or, for a null campaign, simply settle).
  await waitFor(() => expect(screen.getByTestId('shown')).toBeInTheDocument());
  return view;
}

describe('sitewide discount eligibility', () => {
  it("cuts the price of a product MiniRue owns", async () => {
    await renderAt(10, true);
    await waitFor(() =>
      expect(screen.getByTestId('shown')).toHaveTextContent('90.00'),
    );

    expect(screen.getByTestId('shown')).toHaveTextContent('90.00');
    expect(screen.getByTestId('was')).toHaveTextContent('100.00');
  });

  it('leaves an ineligible price untouched, and shows no struck-through price', async () => {
    // The exact failure: a product on a partner's brand. The server says not
    // eligible; nothing here may second-guess that.
    await renderAt(10, false);

    expect(screen.getByTestId('shown')).toHaveTextContent('100.00');
    expect(screen.getByTestId('was')).toHaveTextContent('');
  });

  it('shows the real price when no campaign is running', async () => {
    await renderAt(null, true);

    expect(screen.getByTestId('shown')).toHaveTextContent('100.00');
    expect(screen.getByTestId('was')).toHaveTextContent('');
  });

  it('treats a missing eligibility flag as NOT eligible', async () => {
    // What a caller gets from `product.isMinirueOwned ?? false` when the API
    // response predates the field. Showing a discount that checkout will refuse
    // is worse than missing one it would have honoured, so "unknown" must read
    // as full price.
    const fromApi: { isMinirueOwned?: boolean } = {};
    await renderAt(10, fromApi.isMinirueOwned ?? false);

    expect(screen.getByTestId('shown')).toHaveTextContent('100.00');
    expect(screen.getByTestId('was')).toHaveTextContent('');
  });

  it('rounds the saving up, the way the server does', async () => {
    // 33% off 10.00 => saving 3.30 exactly; 33% off 9.99 => 3.2967, rounded UP
    // to 3.30 so the shopper is never charged more than the advertised cut.
    await renderAt(33, true, '9.99');

    await waitFor(() =>
      expect(screen.getByTestId('shown')).toHaveTextContent('6.69'),
    );
  });
});
