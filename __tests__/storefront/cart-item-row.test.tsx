import React from 'react';
import { render, screen } from '@testing-library/react';
import CartItemRow from '@/components/storefront/cart/CartItemRow';
import type { CartItem } from '@/components/storefront/cart/CartContext';

/**
 * W1.3 — the qty stepper must never let a shopper request more than the
 * variant actually has, and the "Only N left" note must only appear when
 * that ceiling is a real scarcity signal (availableQuantity < 10), not the
 * flat policy cap.
 */

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: 'line-1',
    variantId: 'variant-1',
    qty: 1,
    unitPriceAmount: '100.00',
    unitPriceCurrency: 'EGP',
    lineTotalAmount: '100.00',
    ...overrides,
  };
}

describe('CartItemRow — stock cap (W1.3)', () => {
  it('disables + at availableQuantity = 1', () => {
    render(
      <CartItemRow
        item={makeItem({ qty: 1, availableQuantity: 1 })}
        onUpdateQty={async () => {}}
        onRemove={async () => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
  });

  it('renders "Only 1 left" at availableQuantity = 1', () => {
    render(
      <CartItemRow
        item={makeItem({ qty: 1, availableQuantity: 1 })}
        onUpdateQty={async () => {}}
        onRemove={async () => {}}
      />,
    );

    expect(screen.getByText('Only 1 left')).toBeInTheDocument();
  });

  it('does not render the scarcity note at availableQuantity = 50', () => {
    render(
      <CartItemRow
        item={makeItem({ qty: 1, availableQuantity: 50 })}
        onUpdateQty={async () => {}}
        onRemove={async () => {}}
      />,
    );

    expect(screen.queryByText(/only .* left/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeEnabled();
  });

  it('allows up to 10 when availableQuantity is undefined (stale API response)', () => {
    render(
      <CartItemRow
        item={makeItem({ qty: 9, availableQuantity: undefined })}
        onUpdateQty={async () => {}}
        onRemove={async () => {}}
      />,
    );

    // Not sold-out-looking, and + is still enabled below the flat cap of 10.
    expect(screen.queryByText(/only .* left/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeEnabled();
  });

  it('disables + at qty 10 when availableQuantity is undefined', () => {
    render(
      <CartItemRow
        item={makeItem({ qty: 10, availableQuantity: undefined })}
        onUpdateQty={async () => {}}
        onRemove={async () => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
  });
});
