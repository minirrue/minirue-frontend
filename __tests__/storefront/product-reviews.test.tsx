import React from 'react';
import { render as rtlRender, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProductReviews from '@/components/storefront/reviews/ProductReviews';
import type { PublicReview } from '@/lib/api/reviews';

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

describe('ProductReviews — reviewer byline (owner request 2026-07-30)', () => {
  function review(overrides: Partial<PublicReview> = {}): PublicReview {
    return {
      id: 'rev-1',
      rating: 5,
      title: 'Lovely',
      body: 'Smells wonderful.',
      verifiedPurchase: true,
      createdAt: '2026-07-01T00:00:00.000Z',
      media: [],
      reviewerName: 'Aisha Farouk',
      reviewerAvatarUrl: null,
      ...overrides,
    };
  }

  // ProductReviews renders each review inline AND inside its (always-mounted,
  // visibility-toggled — see MobileSheet.tsx) "read all" sheet, so a review's
  // name/photo legitimately appears twice in the DOM. `getAllByText` /
  // `getAllByTestId`, not the singular `getByText`, is what this section's
  // markup requires — a plain `findByText` throws on the second match.
  it("renders the reviewer's full name", async () => {
    mockUseUser.mockReturnValue({ data: null });
    mockGetProductReviews.mockResolvedValue({
      average: 5,
      count: 1,
      items: [review()],
    });

    renderReviews();

    const matches = await screen.findAllByText('Aisha Farouk');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('shows the generic silhouette, never a blank or an initial letter, when there is no photo', async () => {
    mockUseUser.mockReturnValue({ data: null });
    mockGetProductReviews.mockResolvedValue({
      average: 5,
      count: 1,
      items: [review({ reviewerAvatarUrl: null })],
    });

    renderReviews();

    await screen.findAllByText('Aisha Farouk');
    expect(screen.getAllByTestId('avatar-generic').length).toBeGreaterThan(0);
    // Never a fallback initial letter rendered in its place.
    expect(screen.queryByText('A')).toBeNull();
  });

  it("shows the reviewer's own photo, and not the generic silhouette, when one is on file", async () => {
    mockUseUser.mockReturnValue({ data: null });
    mockGetProductReviews.mockResolvedValue({
      average: 5,
      count: 1,
      items: [
        review({ reviewerAvatarUrl: 'https://cdn.test/avatars/aisha.jpg' }),
      ],
    });

    renderReviews();

    await screen.findAllByText('Aisha Farouk');
    expect(screen.queryByTestId('avatar-generic')).toBeNull();
    // A decorative photo (alt="") has no accessible "img" role, so this reads
    // the DOM directly rather than through screen's role queries.
    const images = Array.from(
      document.querySelectorAll('img'),
    ) as HTMLImageElement[];
    expect(images.length).toBeGreaterThan(0);
    expect(images.every((img) => img.src === 'https://cdn.test/avatars/aisha.jpg')).toBe(true);
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
