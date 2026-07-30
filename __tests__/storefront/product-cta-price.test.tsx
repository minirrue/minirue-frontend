import React from 'react';
import { render as rtlRender, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ApiProductDetail from '@/components/storefront/ApiProductDetail';
import PriceDisplay, { formatPrice } from '@/components/storefront/PriceDisplay';
import { PRODUCT_FIXTURE, IN_STOCK_VARIANT } from './fixtures/product';

// ApiProductDetail reads/writes favourites and reviews through React Query,
// and can redirect a signed-out visitor, so it needs both a client and a
// router — same setup as api-product-detail.test.tsx.
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
}));

function render(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return rtlRender(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

/**
 * W3.1 — the main Add to bag button used to glue currency and raw amount
 * together (`${currency} ${priceAmount}`) instead of going through the
 * formatter, so a Postgres NUMERIC(*,4) value like "400.0000" printed
 * verbatim on the CTA. Every other price on the page renders "EGP 400".
 */
describe('formatPrice (exported from PriceDisplay)', () => {
  it('rounds a raw NUMERIC(*,4) string to whole currency units', () => {
    // Intl.NumberFormat joins the code and the amount with a non-breaking
    // space (U+00A0), not a regular space — match on whitespace generically
    // rather than hardcoding the exact byte.
    expect(formatPrice('400.0000', 'EGP')).toMatch(/^EGP\s400$/);
    expect(formatPrice('400.0000', 'EGP')).not.toContain('400.0000');
  });
});

describe('ApiProductDetail — Add to bag CTA price (W3.1)', () => {
  it('renders "EGP 400", never "400.0000", for a priceAmount of "400.0000"', () => {
    const product = {
      ...PRODUCT_FIXTURE,
      variants: [{ ...IN_STOCK_VARIANT, priceAmount: '400.0000' }],
    };

    render(
      <ApiProductDetail product={product} perks={[]} onBack={() => {}} onAddToBag={() => {}} />,
    );

    const cta = document.querySelector(
      '[data-trace-id="PG-STOREFRONT-CAT-005::EL-BTN-add-to-bag"]',
    );
    expect(cta).not.toBeNull();
    // Non-breaking space (U+00A0) between "EGP" and "400" — see formatPrice test above.
    expect(cta!.textContent).toMatch(/EGP\s400/);
    expect(cta!.textContent).not.toContain('400.0000');
  });
});

/**
 * Constraint from the brief: PriceDisplay's own rendering must stay
 * byte-identical after exporting formatPrice for reuse elsewhere.
 */
describe('PriceDisplay (unchanged by the W3.1 export)', () => {
  it('still renders "EGP 400" for amount "400.0000"', () => {
    render(<PriceDisplay amount="400.0000" currency="EGP" />);
    expect(screen.getByText('EGP 400')).toBeInTheDocument();
  });
});
