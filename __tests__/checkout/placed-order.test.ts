import {
  isCartAlreadyCheckedOut,
  loadPlacedOrder,
  placeWithReplay,
  savePlacedOrder,
} from '@/lib/checkout/placed-order';
import type { OrderSummary } from '@/lib/checkout/checkout-api';

/** #121 — the pieces step 4 uses to survive a refresh without a second order. */

const CHECKED_OUT = { status: 400, message: 'Cart already checked out' };
const noSleep = jest.fn(() => Promise.resolve());

beforeEach(() => {
  sessionStorage.clear();
  noSleep.mockClear();
});

describe('placeWithReplay', () => {
  it('replays only "cart already checked out", with the given back-off, then gives the order', async () => {
    const send = jest
      .fn()
      .mockRejectedValueOnce(CHECKED_OUT)
      .mockRejectedValueOnce(CHECKED_OUT)
      .mockResolvedValueOnce('order');

    await expect(placeWithReplay(send, [10, 20, 40], noSleep)).resolves.toBe('order');
    expect(send).toHaveBeenCalledTimes(3);
    expect(noSleep.mock.calls).toEqual([[10], [20]]);
  });

  it('stops after the last back-off and throws the refusal', async () => {
    const send = jest.fn().mockRejectedValue(CHECKED_OUT);

    await expect(placeWithReplay(send, [10, 20], noSleep)).rejects.toBe(CHECKED_OUT);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it.each([
    ['a 422 discount refusal', { status: 422, message: [{ field: 'discountCode', issue: 'x' }] }],
    ['an empty cart', { status: 400, message: 'Cart is empty' }],
    ['a network failure', new TypeError('Failed to fetch')],
  ])('never repeats %s', async (_label, err) => {
    const send = jest.fn().mockRejectedValue(err);

    await expect(placeWithReplay(send, [10, 20], noSleep)).rejects.toBe(err);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('isCartAlreadyCheckedOut', () => {
  it('matches only the 400 the backend sends for a consumed cart', () => {
    expect(isCartAlreadyCheckedOut(CHECKED_OUT)).toBe(true);
    expect(isCartAlreadyCheckedOut({ status: 409, message: 'Cart already checked out' })).toBe(false);
    expect(isCartAlreadyCheckedOut({ status: 400, message: 'Cart does not belong to this session' })).toBe(false);
    expect(isCartAlreadyCheckedOut(null)).toBe(false);
  });
});

describe('placed order record', () => {
  const order = { id: 'o1', orderNumber: 'MR-1', items: [] } as unknown as OrderSummary;

  it('round-trips the order and the key it was placed with', () => {
    savePlacedOrder(order, 'key-1');
    expect(loadPlacedOrder()).toEqual({ order, idempotencyKey: 'key-1' });
  });

  it('reads nothing from a missing or malformed record', () => {
    expect(loadPlacedOrder()).toBeNull();
    sessionStorage.setItem('mr-checkout-placed', '{not json');
    expect(loadPlacedOrder()).toBeNull();
    sessionStorage.setItem('mr-checkout-placed', JSON.stringify({ order: {} }));
    expect(loadPlacedOrder()).toBeNull();
  });
});
