import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductListingClient from '@/app/shop/all/ProductListingClient';

/**
 * Filters and sort on the shop listing.
 *
 * Two classes of thing are guarded here, and the second is the one that would
 * otherwise rot silently:
 *
 *  1. Choosing a facet writes it to the URL, because that is what makes a
 *     filtered view shareable and back-button-able.
 *
 *  2. "Load more" carries the ACTIVE FILTERS with the cursor. It did not: page
 *     two came back unfiltered and was appended underneath a filtered page
 *     one. Nothing on screen looked wrong until you scrolled far enough to
 *     reach the join, which is exactly the kind of bug that survives review.
 */

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/shop/all',
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

let mockSearch = '';

const listProducts = jest.fn();
/**
 * Only `catalog` is replaced. The rest of the module — primaryMedia,
 * mediaImageUrl, lowestPrice — is what the product grid renders WITH, and a
 * whole-module mock silently removed all of it, so every card threw before any
 * assertion about filters could run.
 */
jest.mock('@/lib/api/catalog', () => ({
  ...jest.requireActual('@/lib/api/catalog'),
  catalog: { listProducts: (...args: unknown[]) => listProducts(...args) },
}));

jest.mock('@/lib/hooks/useBreakpoint', () => ({
  useBreakpoint: () => ({ mobile: false }),
}));

function product(id: string) {
  return {
    id,
    slug: `p-${id}`,
    name: `Product ${id}`,
    media: [],
    variants: [],
  } as never;
}

const BRANDS = [
  { id: 'brand-1', name: 'Billie Eilish' },
  { id: 'brand-2', name: 'Helia' },
];
const CATEGORIES = [{ id: 'cat-1', name: 'Perfumes' }];

function renderListing(overrides: Record<string, unknown> = {}) {
  return render(
    <ProductListingClient
      initialProducts={[product('a')]}
      initialHasMore
      initialCursor="cursor-1"
      initialFilters={{ limit: 24 }}
      brands={BRANDS}
      categories={CATEGORIES}
      {...overrides}
    />,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSearch = '';
  listProducts.mockResolvedValue({
    data: [product('b')],
    meta: { hasMore: false, cursor: null },
  });
});

describe('shop filters', () => {
  it('offers sort, brand and category, and a price range', () => {
    renderListing();

    expect(screen.getByRole('radio', { name: /price: low to high/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /billie eilish/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /perfumes/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/minimum price/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/maximum price/i)).toBeInTheDocument();
  });

  it('writes a chosen brand into the URL rather than filtering in place', async () => {
    const user = userEvent.setup();
    renderListing();

    await user.click(screen.getByRole('radio', { name: /billie eilish/i }));

    // The URL is the state. Without this the view is unshareable, the back
    // button does nothing, and a reload silently drops the filter.
    expect(mockPush).toHaveBeenCalledWith(
      '/shop/all?brandId=brand-1',
      expect.objectContaining({ scroll: false }),
    );
  });

  it('leaves the default sort out of the URL', async () => {
    const user = userEvent.setup();
    mockSearch = 'sort=newest';
    renderListing();

    await user.click(screen.getByRole('radio', { name: /featured/i }));

    // One view, one address. Writing `?sort=relevance` would give the
    // unfiltered listing a second URL and split it from its own canonical.
    expect(mockPush).toHaveBeenCalledWith('/shop/all', expect.anything());
  });

  it('carries the active filters into Load more', async () => {
    const user = userEvent.setup();
    mockSearch = 'brandId=brand-1&sort=price_asc';
    renderListing();

    await user.click(screen.getByRole('button', { name: /load more/i }));

    await waitFor(() => expect(listProducts).toHaveBeenCalled());
    expect(listProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        brandId: 'brand-1',
        sortBy: 'price_asc',
        cursor: 'cursor-1',
      }),
    );
  });

  it('keeps the page’s own scope when a shopper changes a facet', async () => {
    const user = userEvent.setup();
    // A category page pins categoryId through initialFilters. That is the
    // route's scope, not the shopper's filter, and it must survive.
    renderListing({ initialFilters: { categoryId: 'cat-9', limit: 24 }, showCategories: false });
    mockSearch = 'brandId=brand-1';

    await user.click(screen.getByRole('button', { name: /load more/i }));

    await waitFor(() => expect(listProducts).toHaveBeenCalled());
    expect(listProducts).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 'cat-9' }),
    );
  });

  it('hides the category facet where the category IS the page', () => {
    renderListing({ showCategories: false });

    expect(screen.queryByRole('radio', { name: /perfumes/i })).not.toBeInTheDocument();
    // The brand facet still belongs there — narrowing inside a category is
    // exactly what the rail is for.
    expect(screen.getByRole('radio', { name: /billie eilish/i })).toBeInTheDocument();
  });

  it('says the FILTER found nothing, not that the shop is empty', () => {
    mockSearch = 'brandId=brand-1';
    renderListing({ initialProducts: [], initialHasMore: false, initialCursor: null });

    expect(screen.getByText(/nothing matches those filters/i)).toBeInTheDocument();
    expect(screen.queryByText(/no products available/i)).not.toBeInTheDocument();
  });
});
