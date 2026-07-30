import React from 'react';
import { render as rtlRender, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProductReviews from '@/components/storefront/reviews/ProductReviews';

const mockGetProductReviews = jest.fn();
const mockGetReviewEligibility = jest.fn();
jest.mock('@/lib/api/reviews', () => ({
  apiGetProductReviews: (...args: unknown[]) => mockGetProductReviews(...args),
  apiGetReviewEligibility: (...args: unknown[]) => mockGetReviewEligibility(...args),
}));

const mockUseUser = jest.fn();
jest.mock('@/lib/hooks/use-auth', () => ({
  useUser: () => mockUseUser(),
}));

function render(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return rtlRender(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function renderReviews() {
  return render(
    <ProductReviews
      productId="product-no1"
      productName="No.1"
      initialAverage={null}
      initialCount={0}
    />,
  );
}

describe('ProductReviews — empty state copy (W3.3)', () => {
  it('reads "No reviews yet — yours would be the first." when eligible', async () => {
    mockUseUser.mockReturnValue({ data: { id: 'cust-1' } });
    mockGetProductReviews.mockResolvedValue({ average: null, count: 0, items: [] });
    mockGetReviewEligibility.mockResolvedValue({ eligible: true });

    renderReviews();

    expect(
      await screen.findByText('No reviews yet — yours would be the first.'),
    ).toBeInTheDocument();
    // Not the old broken-sentence phrasing.
    expect(screen.queryByText(/you have had this one/i)).toBeNull();
  });

  it('leaves the not-eligible sentence unchanged', async () => {
    mockUseUser.mockReturnValue({ data: null });
    mockGetProductReviews.mockResolvedValue({ average: null, count: 0, items: [] });

    renderReviews();

    expect(
      await screen.findByText('No reviews yet. Only customers who have received this can write one.'),
    ).toBeInTheDocument();
  });
});

describe('ProductReviews — "Write a review" contrast (W3.2)', () => {
  it('computes a cream text colour, not --mr-fg-3, on its near-black background', async () => {
    mockUseUser.mockReturnValue({ data: { id: 'cust-1' } });
    mockGetProductReviews.mockResolvedValue({ average: null, count: 0, items: [] });
    mockGetReviewEligibility.mockResolvedValue({ eligible: true });

    renderReviews();

    const button = await screen.findByRole('button', { name: /write a review/i });
    expect(button.style.color).toBe('var(--mr-cream-100)');
    expect(button.style.color).not.toBe('var(--mr-fg-3)');
    // Background is unchanged — a defect batch fixes the bug, not the look.
    expect(button.style.background).toBe('var(--mr-ink-900)');
  });
});
