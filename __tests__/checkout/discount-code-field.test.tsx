import React, { act } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * minirue-backend#120 — an admin-named code (MINIRUE10) passed preview and was
 * never applied to the order.
 *
 * The field saved `result.code`, which the backend echoed as null for every
 * admin-named code, so localStorage held nothing and Place order sent no
 * `discountCode`. And a re-check on bag change that hit the preview rate limit
 * (429) silently dropped the applied code.
 */

const previewDiscount = jest.fn();

jest.mock('@/lib/api/discounts', () => {
  const actual = jest.requireActual('@/lib/api/discounts');
  return {
    ...actual,
    previewDiscount: (...args: unknown[]) => previewDiscount(...args),
  };
});
const mockTrack = jest.fn();
jest.mock('@/lib/analytics/track', () => ({ track: (...args: unknown[]) => mockTrack(...args) }));

import DiscountCodeField from '@/components/checkout/DiscountCodeField';
import { loadAppliedCode, saveAppliedCode } from '@/lib/api/discounts';

const LINES = [{ variantId: 'v1', qty: 1, unitPriceMinor: 10000 }];

function valid(code: string | null) {
  return {
    valid: true,
    code,
    discountMinor: 1000,
    eligibleSubtotalMinor: 10000,
    appliesToMinirueOnly: false,
    winner: 'CODE' as const,
    bundleSavingsMinor: 0,
    message: null,
  };
}

async function apply(text: string) {
  fireEvent.change(screen.getByRole('textbox'), { target: { value: text } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  });
}

beforeEach(() => {
  previewDiscount.mockReset();
  mockTrack.mockClear();
  window.localStorage.clear();
  jest.useRealTimers();
});

describe('DiscountCodeField (backend#120)', () => {
  it('saves the stored code the server echoes for an admin-named code', async () => {
    previewDiscount.mockResolvedValue(valid('MINIRUE10'));
    render(<DiscountCodeField lines={LINES} />);

    await apply('minirue 10');

    await waitFor(() => expect(loadAppliedCode()).toBe('MINIRUE10'));
    expect(screen.getByText('MINIRUE10')).toBeInTheDocument();
  });

  it('never saves nothing for a code the server accepted', async () => {
    // An older backend echoes null for an admin code. What the shopper typed is
    // still a code the server resolves at placement — dropping it is how the
    // order came to be charged full price.
    previewDiscount.mockResolvedValue(valid(null));
    render(<DiscountCodeField lines={LINES} />);

    await apply('  minirue 10 ');

    await waitFor(() => expect(loadAppliedCode()).toBe('minirue 10'));
  });

  it('keeps the applied code when a re-check is rate limited', async () => {
    saveAppliedCode('MINIRUE10');
    previewDiscount
      .mockResolvedValueOnce(valid('MINIRUE10'))
      .mockRejectedValueOnce({ status: 429, message: 'ThrottlerException: Too Many Requests' });

    const { rerender } = render(<DiscountCodeField lines={LINES} />);
    await waitFor(() => expect(screen.getByText('MINIRUE10')).toBeInTheDocument());

    rerender(
      <DiscountCodeField lines={[{ variantId: 'v1', qty: 2, unitPriceMinor: 10000 }]} />,
    );
    await waitFor(() => expect(previewDiscount).toHaveBeenCalledTimes(2));

    expect(loadAppliedCode()).toBe('MINIRUE10');
    expect(screen.getByText('MINIRUE10')).toBeInTheDocument();
  });

  it('tells the shopper when a code they applied stops being valid', async () => {
    saveAppliedCode('MINIRUE10');
    previewDiscount.mockResolvedValue({
      ...valid(null),
      valid: false,
      discountMinor: 0,
      winner: null,
      message: "This code isn't valid.",
    });

    render(<DiscountCodeField lines={LINES} />);

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent("This code isn't valid."));
    expect(loadAppliedCode()).toBeNull();
  });

  it('Place order forgets a code the server refused and says so', () => {
    const { codeRefusalAtPlacement } = jest.requireActual('@/lib/api/discounts');
    saveAppliedCode('MINIRUE10');

    // Not a code refusal: left alone, and the page shows its usual error.
    expect(codeRefusalAtPlacement({ status: 422, message: [{ field: 'cartId', issue: 'Invalid uuid' }] })).toBeNull();
    expect(loadAppliedCode()).toBe('MINIRUE10');

    const message = codeRefusalAtPlacement({ status: 422, message: "This code isn't valid." });
    expect(message).toMatch(/^This code isn't valid\. .*not placed/);
    expect(loadAppliedCode()).toBeNull();
  });

  it('fires promo_applied exactly once for a user-initiated apply, and never for the silent re-check (#142)', async () => {
    previewDiscount.mockResolvedValue(valid('MINIRUE10'));
    render(<DiscountCodeField lines={LINES} />);

    await apply('minirue10');

    await waitFor(() => expect(loadAppliedCode()).toBe('MINIRUE10'));
    const applies = mockTrack.mock.calls.filter(([name]) => name === 'promo_applied');
    expect(applies).toHaveLength(1);
    expect(applies[0][1]).toEqual({ code: 'MINIRUE10', discountMinor: 1000 });
  });

  it('never fires promo_applied on the silent mount/bag-change re-check of an already-applied code (#142)', async () => {
    // Mirrors DiscountCodeField's own re-check effect: a code already saved
    // from an earlier screen, re-priced quietly on mount — never a shopper
    // pressing Apply.
    saveAppliedCode('MINIRUE10');
    previewDiscount.mockResolvedValue(valid('MINIRUE10'));

    const { rerender } = render(<DiscountCodeField lines={LINES} />);
    await waitFor(() => expect(screen.getByText('MINIRUE10')).toBeInTheDocument());

    // The bag changes, re-triggering the silent re-check — the over-counting
    // bug fired promo_applied on this too, not only on the mount check above.
    rerender(<DiscountCodeField lines={[{ variantId: 'v1', qty: 2, unitPriceMinor: 10000 }]} />);
    await waitFor(() => expect(previewDiscount).toHaveBeenCalledTimes(2), { timeout: 2000 });

    expect(mockTrack.mock.calls.some(([name]) => name === 'promo_applied')).toBe(false);
  });

  it("sends a guest's phone so a per-customer limit is judged in preview", async () => {
    previewDiscount.mockResolvedValue(valid('MINIRUE10'));
    render(<DiscountCodeField lines={LINES} guestPhone="+20 100 555 0120" />);

    await apply('MINIRUE10');

    expect(previewDiscount).toHaveBeenCalledWith(LINES, 'MINIRUE10', {
      guestPhone: '+20 100 555 0120',
    });
  });
});
