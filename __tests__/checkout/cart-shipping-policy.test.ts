import {
  COD_MAX_ORDER_MINOR,
  DEFAULT_SHIPPING_FLAT_MINOR,
  DEFAULT_SHIPPING_POLICY,
  isCodAvailable,
  orderTotalMinor,
  shippingMinorFor,
} from '@/lib/checkout/checkout-money';
import { loadShippingPolicy } from '@/lib/api/settings';

/**
 * #38 — shipping was `SHIPPING_AMOUNT_MINOR = 5_000`, with a comment calling
 * itself a mirror of the backend. It was one, until the backend made the value
 * an admin setting; a mirrored constant cannot notice the thing it mirrors has
 * become configurable.
 *
 * These cases pin the two halves of the fix separately:
 *
 *   - the arithmetic takes a policy and applies it the way the backend's
 *     `shippingMinorFor` does, including the `>=` on the free-delivery
 *     threshold and the 0-means-disabled convention
 *   - the reader turns whatever `/settings/public` sends into that policy, and
 *     falls back to the backend's own default for every input it cannot trust
 *
 * The fallback cases are not padding. `/v1/settings/public` does not expose
 * `shipping` at all today, so on the live backend EVERY read takes the
 * fallback path — it is the branch the shop currently runs on.
 */

describe('shippingMinorFor', () => {
  it('charges the configured flat rate', () => {
    expect(shippingMinorFor(79_900, { flatMinor: 8_000, freeOverMinor: 0 })).toBe(
      8_000,
    );
  });

  it('treats freeOverMinor of 0 as "no threshold", not as "always free"', () => {
    // Every subtotal is >= 0. Without this convention the shop would deliver
    // free forever the moment an admin cleared the field.
    expect(shippingMinorFor(0, { flatMinor: 5_000, freeOverMinor: 0 })).toBe(5_000);
  });

  it('is free at exactly the threshold, not only above it', () => {
    // `>=`, matching the backend. A bag of exactly EGP 3,000 against a
    // "free over EGP 3,000" promise is the order that generates the complaint.
    expect(
      shippingMinorFor(300_000, { flatMinor: 5_000, freeOverMinor: 300_000 }),
    ).toBe(0);
    expect(
      shippingMinorFor(299_999, { flatMinor: 5_000, freeOverMinor: 300_000 }),
    ).toBe(5_000);
  });

  it('falls back to the default rate on a nonsense policy', () => {
    expect(
      shippingMinorFor(1_000, { flatMinor: Number.NaN, freeOverMinor: 0 }),
    ).toBe(DEFAULT_SHIPPING_FLAT_MINOR);
    expect(shippingMinorFor(1_000, { flatMinor: -1, freeOverMinor: 0 })).toBe(
      DEFAULT_SHIPPING_FLAT_MINOR,
    );
  });

  it('defaults to the backend fallback when handed no policy at all', () => {
    expect(shippingMinorFor(1_000)).toBe(DEFAULT_SHIPPING_FLAT_MINOR);
  });
});

describe('orderTotalMinor', () => {
  it('is subtotal − discount + shipping', () => {
    // The bag in #36: EGP 799, 10% sitewide, EGP 50 delivery.
    expect(
      orderTotalMinor('799.00', {
        discountMinor: 7_990,
        shipping: { flatMinor: 5_000, freeOverMinor: 0 },
      }),
    ).toBe(76_910);
  });

  it('floors the discount against the goods, never against the shipping', () => {
    // A discount larger than the bag must not also pay for delivery — the
    // order would be placed for less than it costs to send.
    expect(
      orderTotalMinor('10.00', {
        discountMinor: 999_999,
        shipping: { flatMinor: 5_000, freeOverMinor: 0 },
      }),
    ).toBe(5_000);
  });

  it('judges free delivery on the subtotal BEFORE the discount', () => {
    // The backend's default freeShippingBasis. A bag that earned free delivery
    // does not lose it the instant a code is applied.
    expect(
      orderTotalMinor('3000.00', {
        discountMinor: 30_000,
        shipping: { flatMinor: 5_000, freeOverMinor: 300_000 },
      }),
    ).toBe(270_000);
  });

  it('still adds the default fee when called with no options', () => {
    // The three checkout routes that have not been converted yet rely on this.
    expect(orderTotalMinor('100.00')).toBe(10_000 + DEFAULT_SHIPPING_FLAT_MINOR);
  });
});

describe('isCodAvailable', () => {
  it('gates on the discounted total, not the subtotal', () => {
    const subtotal = '460.00';
    expect(isCodAvailable(subtotal)).toBe(false); // 46_000 + 5_000 > 50_000
    expect(isCodAvailable(subtotal, { discountMinor: 4_600 })).toBe(true);
  });

  it('allows an order sitting exactly on the ceiling', () => {
    expect(orderTotalMinor('450.00')).toBe(COD_MAX_ORDER_MINOR);
    expect(isCodAvailable('450.00')).toBe(true);
  });
});

describe('loadShippingPolicy', () => {
  const realFetch = global.fetch;

  function respondWith(body: unknown, ok = true) {
    global.fetch = jest.fn(async () => ({
      ok,
      json: async () => body,
    })) as unknown as typeof fetch;
  }

  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it('reads the admin-saved rate and threshold when the endpoint sends them', async () => {
    respondWith({ shipping: { flatRateCents: 8_000, freeOverCents: 300_000 } });
    await expect(loadShippingPolicy()).resolves.toEqual({
      flatMinor: 8_000,
      freeOverMinor: 300_000,
    });
  });

  it('falls back when the response carries no shipping block', async () => {
    // This is the live backend today: /v1/settings/public returns
    // { storeName, displayName, currency, logoUrl, storefront } and nothing
    // else. The cart shows 5 000 because a read came back empty, which is a
    // different thing from 5 000 being compiled into the page.
    respondWith({ storeName: 'MiniRue', currency: 'EGP' });
    await expect(loadShippingPolicy()).resolves.toEqual(DEFAULT_SHIPPING_POLICY);
  });

  it('falls back on a string where a number was expected', async () => {
    // The exact shape the backend's own repository guards against: a JSONB
    // write that stored "8000" rather than 8000.
    respondWith({ shipping: { flatRateCents: '8000', freeOverCents: '0' } });
    await expect(loadShippingPolicy()).resolves.toEqual(DEFAULT_SHIPPING_POLICY);
  });

  it('never throws — a settings read is not a reason the bag cannot render', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    await expect(loadShippingPolicy()).resolves.toEqual(DEFAULT_SHIPPING_POLICY);
  });

  it('falls back on a non-2xx response', async () => {
    respondWith({}, false);
    await expect(loadShippingPolicy()).resolves.toEqual(DEFAULT_SHIPPING_POLICY);
  });
});
