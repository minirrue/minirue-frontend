import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { apiFetch } from '@/lib/api/client';
import CardPrice from '@/components/storefront/CardPrice';
import type { ApiProduct } from '@/lib/api/catalog';
import { SitewideDiscountProvider, useDiscountedPrice } from '@/lib/hooks/use-sitewide-discount';

// The provider fetches the live offer on mount; this decides what it gets.
// `mockCapped` undefined = an API that predates floor caps (sends no map).
let mockPercent: number | null = null;
let mockCapped: Record<string, number> | undefined;
jest.mock('@/lib/api/client', () => ({
  apiFetch: jest.fn(async () =>
    mockCapped === undefined
      ? { percent: mockPercent }
      : { percent: mockPercent, cappedOffers: mockCapped },
  ),
}));

beforeEach(() => {
  mockCapped = undefined;
  (apiFetch as jest.Mock).mockClear();
});

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
  variantId,
}: {
  amount: string;
  eligible: boolean;
  variantId?: string;
}) {
  const shown = useDiscountedPrice(amount, eligible, variantId);
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
  variantId?: string,
) {
  mockPercent = percent;
  const view = render(
    <SitewideDiscountProvider>
      <Price amount={amount} eligible={eligible} variantId={variantId} />
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

/**
 * Floor caps (Accounting epic, backend#155). Checkout never lets a markdown
 * take a product below its floor; for those variants the server sends the
 * price it will charge. A card showing the plain percentage there would
 * advertise 606.75 and charge 659.
 */
describe('sitewide discount floor caps', () => {
  it('shows the price checkout charges for a floor-capped variant', async () => {
    mockCapped = { v1: 65900 };
    await renderAt(25, true, '809.00', 'v1');
    await waitFor(() => expect(screen.getByTestId('shown')).toHaveTextContent('659.00'));
    expect(screen.getByTestId('was')).toHaveTextContent('809.00');
  });

  it('keeps the plain percentage for a variant the floor does not cap', async () => {
    mockCapped = { v1: 65900 };
    await renderAt(25, true, '809.00', 'v2');
    await waitFor(() => expect(screen.getByTestId('shown')).toHaveTextContent('606.75'));
  });

  it('never lets a cap make a price cheaper than the percentage itself', async () => {
    mockCapped = { v1: 100 };
    await renderAt(10, true, '809.00', 'v1');
    // 10% off 809.00 = 728.10; a malformed low cap must not undercut that.
    await waitFor(() => expect(screen.getByTestId('shown')).toHaveTextContent('728.10'));
  });

  it('strikes nothing through when the cap holds the full price', async () => {
    mockCapped = { v1: 80900 };
    await renderAt(25, true, '809.00', 'v1');
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('shown')).toHaveTextContent('809.00'));
    expect(screen.getByTestId('was')).toHaveTextContent('');
  });

  it('ignores the variant id entirely when the API sends no cap map', async () => {
    await renderAt(25, true, '809.00', 'v1');
    await waitFor(() => expect(screen.getByTestId('shown')).toHaveTextContent('606.75'));
  });

  it('re-reads the offer when the window regains focus, at most every 30s', async () => {
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(1_000_000);
    await renderAt(10, true);
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));

    now.mockReturnValue(1_010_000); // 10s later: too soon
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(apiFetch).toHaveBeenCalledTimes(1);

    now.mockReturnValue(1_031_000); // 31s after the first read
    mockPercent = 20;
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId('shown')).toHaveTextContent('80.00'));
    now.mockRestore();
  });

  it('a card quotes the variant that is cheapest AFTER the offer', async () => {
    // v1 is cheaper before the offer but held at its floor (659); v2 drops to
    // 621.75 under 25% off, so the card must say 621.75, not 659.
    mockPercent = 25;
    mockCapped = { v1: 65900 };
    const product = {
      id: 'p1',
      slug: 'p1',
      name: 'Serum',
      isMinirueOwned: true,
      variants: [
        { id: 'v1', sku: 'A', priceAmount: '809.0000', priceCurrency: 'EGP', isActive: true },
        { id: 'v2', sku: 'B', priceAmount: '829.0000', priceCurrency: 'EGP', isActive: true },
      ],
    } as unknown as ApiProduct;
    render(
      <SitewideDiscountProvider>
        <CardPrice price={{ amount: '809.0000', currency: 'EGP' }} product={product} />
      </SitewideDiscountProvider>,
    );
    await waitFor(() => expect(screen.getByText(/621\.75/)).toBeInTheDocument());
    expect(screen.queryByText(/659/)).not.toBeInTheDocument();
  });
});
