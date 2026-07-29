import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ApiProductDetail from '@/components/storefront/ApiProductDetail';
import { PRODUCT_FIXTURE } from './fixtures/product';

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

describe('ApiProductDetail', () => {
  it('does not remount the info panel when the wishlist heart is tapped', async () => {
    renderDetail();
    const panelBefore = screen.getByTestId('product-info-panel');
    const titleBefore = screen.getByTestId('product-title');

    await userEvent.click(screen.getByRole('button', { name: /save to wishlist/i }));

    expect(screen.getByTestId('product-info-panel')).toBe(panelBefore);
    expect(screen.getByTestId('product-title')).toBe(titleBefore);
  });

  it('does not remount the info panel when a size is added to the bag', async () => {
    renderDetail();
    const panelBefore = screen.getByTestId('product-info-panel');
    const titleBefore = screen.getByTestId('product-title');

    await userEvent.click(screen.getByRole('button', { name: /add to bag/i }));

    expect(screen.getByTestId('product-info-panel')).toBe(panelBefore);
    expect(screen.getByTestId('product-title')).toBe(titleBefore);
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
