import React from 'react';
import { render, screen } from '@testing-library/react';
import { formatMoney } from '@/lib/format/money';
import { formatOrderTotal } from '@/lib/orders/order-format';
import ProductCard from '@/components/storefront/ProductCard';
import CatalogProductCard from '@/components/storefront/CatalogProductCard';
import { PRODUCT_FIXTURE } from './fixtures/product';
import type { ApiProduct } from '@/lib/api/catalog';

/**
 * #1 — the home page printed `EGP 799.0000`.
 *
 * `ProductCard` interpolated the raw value straight into the DOM:
 *
 *     {price.currency} {price.amount}
 *
 * `price.amount` is a `NUMERIC(*,4)` string off the wire, so that one line
 * produced both reported symptoms at once: four decimal places, and no
 * sitewide discount, because the interpolation skipped the hook as well. The
 * same products on /shop/all read `EGP 799  EGP 719`, because that card went
 * through `CardPrice`.
 *
 * The defect was two divergent price renderers; the visible bug was the
 * symptom. So the assertions below are about them agreeing, not just about one
 * of them being right.
 */

jest.mock('@/lib/hooks/useIsTouch', () => ({ useIsTouch: () => false }));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ prefetch: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/components/storefront/WishlistHeart', () => ({
  __esModule: true,
  default: () => null,
}));

/** A product priced the way the API actually sends it. */
function pricedAt(amount: string, over: Partial<ApiProduct> = {}): ApiProduct {
  return {
    ...PRODUCT_FIXTURE,
    isMinirueOwned: true,
    variants: [
      {
        ...PRODUCT_FIXTURE.variants[0],
        priceAmount: amount,
        priceCurrency: 'EGP',
      },
    ],
    ...over,
  } as ApiProduct;
}

/**
 * Intl separates the currency from the number with a NON-BREAKING space, which
 * is right — "EGP" and "799" must not be split across a line break — and
 * invisible in an assertion. Normalised here so the expectations read as the
 * price a shopper sees.
 */
const plain = (s: string | null) => (s ?? '').replace(/\u00a0/g, ' ');

describe('formatMoney — one rule for every price on the site', () => {
  it('drops the decimal part when the amount is whole', () => {
    // The reported string, exactly as the database sends it.
    expect(plain(formatMoney('799.0000', 'EGP'))).toBe('EGP 799');
  });

  it('never prints a trailing .00', () => {
    expect(plain(formatMoney('799.00', 'EGP'))).toBe('EGP 799');
    expect(plain(formatMoney(450, 'EGP'))).toBe('EGP 450');
  });

  it('keeps decimals that are real, and both of them', () => {
    // `maximumFractionDigits: 0` used to round this to EGP 800 — a price the
    // shop does not charge. `minimumFractionDigits: 0` alone gives "799.5",
    // which is not how anyone writes a price.
    expect(plain(formatMoney('799.5000', 'EGP'))).toBe('EGP 799.50');
    expect(plain(formatMoney('799.9900', 'EGP'))).toBe('EGP 799.99');
  });

  it('separates thousands, so 1,299 cannot be read as 129', () => {
    expect(plain(formatMoney('1299.0000', 'EGP'))).toBe('EGP 1,299');
    expect(plain(formatMoney('12999.5000', 'EGP'))).toBe('EGP 12,999.50');
  });

  it('shows an unparseable amount as it came rather than as NaN or 0', () => {
    // A wrong price is worse than an obviously broken one.
    expect(plain(formatMoney('', 'EGP'))).toBe('EGP ');
    expect(plain(formatMoney('not-a-price', 'EGP'))).toBe('EGP not-a-price');
  });

  it('falls back to the same rule for a currency Intl does not know', () => {
    expect(plain(formatMoney('1299.0000', 'ZZZ'))).toBe('ZZZ 1,299');
  });

  it('order history reads exactly like a product card', () => {
    // These were two separate formatters: order history fixed two decimals, so
    // it said "EGP 450.00" about a product the card priced "EGP 450".
    expect(formatOrderTotal('450.0000', 'EGP')).toBe(formatMoney('450.0000', 'EGP'));
    expect(plain(formatOrderTotal('450.0000', 'EGP'))).toBe('EGP 450');
  });
});

describe('ProductCard — the home page price', () => {
  it('never puts a raw NUMERIC(*,4) amount in the DOM', () => {
    const { container } = render(<ProductCard product={pricedAt('799.0000')} />);

    expect(container.textContent).not.toMatch(/\d\.\d{3,}/);
    expect(container.textContent).not.toContain('799.0000');
  });

  it('renders the reported price as EGP 799', () => {
    render(<ProductCard product={pricedAt('799.0000')} />);

    expect(screen.getByText('EGP 799')).toBeInTheDocument();
  });

  it('reads identically to the /shop/all card for the same product', () => {
    // The assertion that matters: the bug was two renderers disagreeing, and a
    // fix that only corrects one of them leaves that in place.
    const product = pricedAt('1299.5000');
    const home = render(<ProductCard product={product} />);
    const homePrice = plain(home.getByText(/EGP/).textContent);
    home.unmount();

    const catalog = render(<CatalogProductCard product={product} />);
    expect(plain(catalog.getByText(/EGP/).textContent)).toBe(homePrice);
    expect(homePrice).toBe('EGP 1,299.50');
  });
});
