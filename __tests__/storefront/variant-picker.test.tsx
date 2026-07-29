import React from 'react';
import { render, screen } from '@testing-library/react';
import VariantPicker from '@/components/storefront/VariantPicker';
import { IN_STOCK_VARIANT, SOLD_OUT_VARIANT } from './fixtures/product';

/**
 * A sold-out size used to be drawn with a strikethrough AND at 40% opacity —
 * two refusals stacked on top of each other, and the result was that neither
 * the size nor the price could be read. Say "no" once, legibly.
 */
describe('VariantPicker', () => {
  it('keeps a sold-out size readable and says so in words', () => {
    render(
      <VariantPicker
        variants={[IN_STOCK_VARIANT, SOLD_OUT_VARIANT]}
        selectedId={IN_STOCK_VARIANT.id}
        onChange={() => {}}
      />,
    );

    const soldOutPill = screen.getByRole('button', { name: /100 ML/i });
    expect(soldOutPill).toBeDisabled();
    expect(soldOutPill).toHaveTextContent(/sold out/i);
    expect(soldOutPill).not.toHaveTextContent('700');
    expect(soldOutPill.style.textDecoration).not.toMatch(/line-through/);
  });

  it('still shows the price on a size that can be bought', () => {
    render(
      <VariantPicker
        variants={[IN_STOCK_VARIANT, SOLD_OUT_VARIANT]}
        selectedId={IN_STOCK_VARIANT.id}
        onChange={() => {}}
      />,
    );

    const sellablePill = screen.getByRole('button', { name: /50 ML/i });
    expect(sellablePill).toBeEnabled();
    expect(sellablePill).toHaveTextContent('400');
  });
});
