import React from 'react';
import { render, screen } from '@testing-library/react';
import CartItemRow from '@/components/storefront/cart/CartItemRow';
import { groupBagLines, UNNAMED_LINE_LABEL } from '@/components/storefront/cart/bag-lines';
import type { CartItemDto } from '@/lib/api/cart';

/**
 * W1.3 — the qty stepper must never let a shopper request more than the
 * variant actually has, and the "Only N left" note must only appear when
 * that ceiling is a real scarcity signal (availableQuantity < 10), not the
 * flat policy cap.
 *
 * The row renders a bag LINE now rather than a cart row (#56), so these build
 * one through the real grouping instead of hand-writing the display model.
 */

function makeItem(overrides: Partial<CartItemDto> = {}): CartItemDto {
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

function lineOf(overrides: Partial<CartItemDto> = {}) {
  return groupBagLines([makeItem(overrides)])[0];
}

describe('CartItemRow — stock cap (W1.3)', () => {
  it('disables + at availableQuantity = 1', () => {
    render(
      <CartItemRow
        line={lineOf({ qty: 1, availableQuantity: 1 })}
        onUpdateQty={async () => {}}
        onRemove={async () => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
  });

  it('renders "Only 1 left" at availableQuantity = 1', () => {
    render(
      <CartItemRow
        line={lineOf({ qty: 1, availableQuantity: 1 })}
        onUpdateQty={async () => {}}
        onRemove={async () => {}}
      />,
    );

    expect(screen.getByText('Only 1 left')).toBeInTheDocument();
  });

  it('does not render the scarcity note at availableQuantity = 50', () => {
    render(
      <CartItemRow
        line={lineOf({ qty: 1, availableQuantity: 50 })}
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
        line={lineOf({ qty: 9, availableQuantity: undefined })}
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
        line={lineOf({ qty: 10, availableQuantity: undefined })}
        onUpdateQty={async () => {}}
        onRemove={async () => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
  });
});

describe('CartItemRow — never a raw identifier (#56)', () => {
  it('shows a plain label, not "Variant #<uuid>", when nothing named the line', () => {
    render(
      <CartItemRow
        line={lineOf({ variantId: '6c5db783-4d47-41b5-8308-2990c54958cf', name: undefined })}
        onUpdateQty={async () => {}}
        onRemove={async () => {}}
      />,
    );

    expect(screen.queryByText(/Variant #/)).not.toBeInTheDocument();
    expect(screen.queryByText(/6c5db783/)).not.toBeInTheDocument();
    expect(screen.getAllByText(UNNAMED_LINE_LABEL).length).toBeGreaterThan(0);
  });
});
