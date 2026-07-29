import React from 'react';
import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ApiProductDetail from '@/components/storefront/ApiProductDetail';
import { PRODUCT_FIXTURE } from './fixtures/product';

// The page saves favourites and reads reviews through React Query, and sends a
// signed-out visitor to /login, so it needs both a client and a router.
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
}));

function render(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return rtlRender(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

/**
 * The bug this file locks down: BackButton and InfoPanel used to be declared
 * INSIDE ApiProductDetail's body, so every render created a new component type.
 * React tears down a subtree whose type changed, and the freshly mounted nodes
 * re-run their CSS entrance keyframes — which is why tapping the heart replayed
 * "BILLIE EILLISH / No.1 / EGP 400 / ML / 50 ML · EGP 400 / OUT OF STOCK".
 *
 * Comparing DOM node identity is the honest assertion: same object means React
 * re-rendered in place; a different object means it remounted.
 */

function renderDetail() {
  return render(
    <ApiProductDetail
      product={PRODUCT_FIXTURE}
      perks={[]}
      onBack={() => {}}
      onAddToBag={() => {}}
    />,
  );
}

/**
 * The buy button and the heart each appear twice — once in the copy column and
 * once in the sticky bar — and CSS shows one or the other by width. Queries
 * here name which copy they mean rather than guessing.
 */
function byTrace(traceId: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-trace-id="${traceId}"]`);
  if (!el) throw new Error(`No element with trace id ${traceId}`);
  return el;
}

describe('ApiProductDetail', () => {
  it('does not remount the info panel when the wishlist heart is tapped', async () => {
    renderDetail();
    const panelBefore = screen.getByTestId('product-info-panel');
    const titleBefore = screen.getByTestId('product-title');

    await userEvent.click(
      byTrace('PG-STOREFRONT-CAT-005::EL-BTN-toggle-wishlist'),
    );

    expect(screen.getByTestId('product-info-panel')).toBe(panelBefore);
    expect(screen.getByTestId('product-title')).toBe(titleBefore);
  });

  it('does not remount the info panel when a size is added to the bag', async () => {
    renderDetail();
    const panelBefore = screen.getByTestId('product-info-panel');
    const titleBefore = screen.getByTestId('product-title');

    await userEvent.click(byTrace('PG-STOREFRONT-CAT-005::EL-BTN-add-to-bag'));

    expect(screen.getByTestId('product-info-panel')).toBe(panelBefore);
    expect(screen.getByTestId('product-title')).toBe(titleBefore);
  });

  it('keeps a buy button under the thumb on a phone', () => {
    renderDetail();
    const bar = screen.getByTestId('buy-bar');

    // Sticky rather than fixed, so it sits in the flow and cannot cover the
    // end of the page; hidden on a laptop, where the copy column is pinned
    // already and this would be a second button saying the same thing.
    expect(bar.className).toContain('sticky');
    expect(bar.className).toContain('lg:hidden');
    expect(
      byTrace('PG-STOREFRONT-CAT-005::EL-BTN-add-to-bag-sticky'),
    ).toBeInTheDocument();
  });

  it('ends the page on the closing photograph and not on a sizes panel', () => {
    renderDetail();
    // The fixture marks no closing image, so neither should be there.
    expect(screen.queryByText(/available sizes/i)).toBeNull();
    expect(
      document.querySelector(
        '[data-trace-id="PG-STOREFRONT-CAT-005::EL-IMG-product-closing-image"]',
      ),
    ).toBeNull();
  });

  it('does not remount the info panel when a different size is picked', async () => {
    renderDetail();
    const panelBefore = screen.getByTestId('product-info-panel');

    // 50 ML is selected by default; picking it again still re-renders the tree.
    await userEvent.click(screen.getByRole('button', { name: /50 ML/i }));

    expect(screen.getByTestId('product-info-panel')).toBe(panelBefore);
  });

  it('renders exactly one product tree at any viewport, laid out by CSS', () => {
    const { container } = renderDetail();

    expect(container.querySelectorAll('[data-testid="product-info-panel"]')).toHaveLength(1);
    // The desktop split is a CSS concern now — no JS width branch, so no
    // phone-tree-then-desktop-tree double mount for desktop visitors.
    expect(container.querySelector('[data-testid="product-layout"]')).toHaveClass('lg:flex-row');
  });
});
