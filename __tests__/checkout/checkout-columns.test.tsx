import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, screen } from '@testing-library/react';
import CheckoutColumns from '@/components/checkout/CheckoutColumns';

/**
 * The checkout's two screens (frontend#80, #101, #102): the order summary is a
 * right column level with the stepper, and on a phone it stacks where each
 * step wants it. jsdom does not lay out, so the geometry is pinned in the CSS
 * and was measured in Chrome; this file pins the structure the CSS relies on.
 */

const css = fs.readFileSync(path.join(__dirname, '..', '..', 'app', 'styles', 'mr-tokens.css'), 'utf8');

describe('CheckoutColumns', () => {
  it('puts the header, body and aside in the grid as siblings', () => {
    const { container } = render(
      <CheckoutColumns header={<nav aria-label="Checkout progress" />} aside={<p>Total</p>}>
        <p>Payment method</p>
      </CheckoutColumns>,
    );
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.className).toContain('mr-checkout-cols--aside');
    expect([...grid.children].map((c) => c.className)).toEqual([
      'mr-checkout-cols__header',
      'mr-checkout-cols__body',
      'mr-checkout-cols__aside',
    ]);
    expect(screen.getByRole('complementary', { name: 'Order summary' })).toHaveTextContent('Total');
  });

  it('is a single column with no aside (an empty bag)', () => {
    const { container } = render(<CheckoutColumns header={<h1>Your bag</h1>}>empty</CheckoutColumns>);
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.className).toBe('mr-checkout-cols');
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('marks where the aside stacks on a phone', () => {
    const { container } = render(
      <CheckoutColumns header="h" aside="a" asideWhenStacked="between">
        b
      </CheckoutColumns>,
    );
    expect((container.firstElementChild as HTMLElement).dataset.asideStacked).toBe('between');
  });

  it('spans the aside across the header and body rows from 900px, sticky', () => {
    const wide = css.slice(css.indexOf('@media (min-width: 900px)', css.indexOf('.mr-checkout-cols')));
    expect(wide).toMatch(/grid-row:\s*1 \/ span 2/);
    expect(wide).toMatch(/position:\s*sticky/);
    expect(wide).toMatch(/minmax\(0, 1fr\) minmax\(300px, 360px\)/);
  });
});
