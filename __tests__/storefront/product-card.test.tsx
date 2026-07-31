import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ProductCard from '@/components/storefront/ProductCard';
import { PRODUCT_FIXTURE } from './fixtures/product';

/**
 * Fix wave item 6 — ProductCard became keyboard-focusable when it switched
 * from a div+onClick to a real <a> (Next Link), but the isTouch two-tap
 * reveal gate did not account for that: on a hybrid touch+keyboard device
 * (isTouch === true — the device HAS a touchscreen, whether or not this
 * particular activation came from one), pressing Enter/Space on a focused
 * card hit the same preventDefault "reveal, don't navigate" branch a real
 * touch tap gets, and needed a second activation to actually navigate — with
 * no way to "tap" a keyboard to reveal first.
 *
 * The fix: a click event synthesised from keyboard activation always has
 * detail === 0; a real pointer click has detail >= 1. That's used to exempt
 * keyboard activation from the two-tap gate, which still applies unchanged
 * to real touch taps.
 */

jest.mock('@/lib/hooks/useIsTouch', () => ({
  useIsTouch: () => true,
}));

jest.mock('@/components/storefront/WishlistHeart', () => ({
  __esModule: true,
  default: () => null,
}));

describe('ProductCard — keyboard activation on a touch-capable device', () => {
  it('navigates on a single Enter-synthesised click (detail 0), not a two-tap reveal', () => {
    const onClick = jest.fn();
    render(<ProductCard product={PRODUCT_FIXTURE} onClick={onClick} />);

    const link = screen.getByRole('link', { name: new RegExp(PRODUCT_FIXTURE.name) });
    // jsdom's userEvent keyboard activation dispatches a click with detail: 0,
    // same as a real browser's Enter/Space-synthesised click.
    fireEvent.click(link, { detail: 0 });

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('still requires a first tap to reveal before navigating on a real touch tap (unchanged)', () => {
    const onClick = jest.fn();
    render(<ProductCard product={PRODUCT_FIXTURE} onClick={onClick} />);

    const link = screen.getByRole('link', { name: new RegExp(PRODUCT_FIXTURE.name) });
    // A real pointer click carries detail >= 1.
    fireEvent.click(link, { detail: 1 });
    expect(onClick).not.toHaveBeenCalled();

    fireEvent.click(link, { detail: 1 });
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
