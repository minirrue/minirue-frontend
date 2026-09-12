import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CheckoutDeliveryPage from '@/app/checkout/page';
import type { EffectiveShipping } from '@/lib/checkout/governorate-rates';
import { DEFAULT_EFFECTIVE_SHIPPING } from '@/lib/checkout/governorate-rates';

/**
 * #83, storefront half — the governorate becomes a `<select>` and the summary
 * follows it.
 *
 * The unit tests next door pin the arithmetic. These pin the three things a
 * shopper can actually be harmed by, and that no amount of correct arithmetic
 * prevents on its own:
 *
 *  1. the summary must MOVE when the select does, or the shop has a picker
 *     that changes the invoice and nothing else;
 *  2. an address whose free text matches nothing must still check out, and
 *     must be able to SEE that it matched nothing — the silent global-rate
 *     fallback is the defect the issue is about;
 *  3. a shop with no rate table (which is every deploy today) must get the
 *     field it has always had.
 */

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), prefetch: jest.fn() }),
}));

jest.mock('@/lib/hooks/use-auth', () => ({
  // A guest: the branch that owns the typed address, and therefore the select.
  useUser: () => ({ data: undefined, isPending: false }),
}));

jest.mock('@/lib/hooks/use-customer', () => ({
  useCustomerAddresses: () => ({ data: undefined, isLoading: false }),
}));

jest.mock('@/components/storefront/cart/CartContext', () => ({
  useCart: () => ({
    cartId: '11111111-1111-4111-8111-111111111111',
    itemCount: 1,
    lines: [],
    bundleIndex: new Map(),
    subtotalAmount: '450.00',
    currency: 'EGP',
  }),
}));

jest.mock('@/components/checkout/CheckoutShell', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

/**
 * The policy is injected rather than fetched.
 *
 * The live shop publishes an EMPTY table, so a test that waited for the real
 * endpoint could only ever exercise the fallback path — the one case that is
 * already the pre-#83 behaviour. Driving the hook directly is what makes the
 * table-present branch testable at all, which is precisely the branch no
 * deployment can demonstrate yet.
 */
let mockEffective: EffectiveShipping = DEFAULT_EFFECTIVE_SHIPPING;
jest.mock('@/components/storefront/cart/use-bag-pricing', () => ({
  useEffectiveShipping: () => mockEffective,
  useCodMaxOrderMinor: () => 50_000,
  useAutomaticDiscount: () => null,
}));

const RATES: EffectiveShipping = {
  flatRateCents: 10_000,
  freeOverCents: 0,
  currency: 'EGP',
  freeShippingBasis: 'BEFORE_DISCOUNT',
  rates: [
    { key: 'cairo', label: 'Cairo', feeCents: 6_000, enabled: true, aliases: ['Kahira'] },
    { key: 'giza', label: 'Giza', feeCents: 7_500, enabled: true, aliases: [] },
    { key: 'aswan', label: 'Aswan', feeCents: 12_000, enabled: true, aliases: [] },
    { key: 'sinai', label: 'North Sinai', feeCents: 3_000, enabled: false, aliases: [] },
  ],
  minFeeCents: 6_000,
};

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();
  mockEffective = DEFAULT_EFFECTIVE_SHIPPING;
});

/**
 * The summary card's delivery row.
 *
 * Addressed by its trace id rather than by the word "Shipping", which also
 * appears in the site footer's links — a query that matched both would pass or
 * fail for reasons that have nothing to do with this feature.
 */
function shippingRowText(): string {
  const row = document.querySelector(
    '[data-trace-id="PG-STOREFRONT-CHK-002::EL-ROW-shipping"]',
  );
  return row?.textContent ?? '';
}

describe('the governorate field', () => {
  it('is a SELECT of the shop’s own governorates, not a text box', async () => {
    mockEffective = RATES;
    render(<CheckoutDeliveryPage />);

    const select = await screen.findByLabelText(/governorate/i);
    expect(select.tagName).toBe('SELECT');

    const options = within(select as HTMLSelectElement)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options).toEqual(
      expect.arrayContaining(['Cairo', 'Giza', 'Aswan']),
    );
  });

  it('does not offer a DISABLED governorate', async () => {
    // `minFeeCents` excludes disabled rows, so offering one would let a shopper
    // pick a fee the bag's "from EGP X" never counted. DECISION 3 says the
    // backend still charges that row if an address already names it — hiding it
    // from this list must not, and does not, change that.
    mockEffective = RATES;
    render(<CheckoutDeliveryPage />);

    const select = await screen.findByLabelText(/governorate/i);
    expect(
      within(select as HTMLSelectElement).queryByRole('option', {
        name: 'North Sinai',
      }),
    ).not.toBeInTheDocument();
  });

  it('stays a free-text input when the shop publishes no table', async () => {
    // Every deploy today. The back-compat guarantee of #83 is a code path here,
    // not a promise in a comment.
    mockEffective = DEFAULT_EFFECTIVE_SHIPPING;
    render(<CheckoutDeliveryPage />);

    const field = await screen.findByLabelText(/governorate/i);
    expect(field.tagName).toBe('INPUT');

    await userEvent.type(field, 'Cairo');
    expect(field).toHaveValue('Cairo');
  });
});

describe('the summary follows the select', () => {
  it('changes the shipping row when the governorate changes', async () => {
    mockEffective = RATES;
    render(<CheckoutDeliveryPage />);

    const select = await screen.findByLabelText(/governorate/i);

    // Before a choice: the shop's published floor, labelled "from", because the
    // bag said the same thing and neither screen can know the fee yet.
    expect(shippingRowText()).toMatch(/from/i);
    expect(shippingRowText()).toContain('60');

    await userEvent.selectOptions(select, 'cairo');
    await waitFor(() => expect(shippingRowText()).toContain('60'));
    expect(shippingRowText()).not.toMatch(/from/i);
    expect(shippingRowText()).toContain('Cairo');

    await userEvent.selectOptions(select, 'aswan');
    await waitFor(() => expect(shippingRowText()).toContain('120'));
    expect(shippingRowText()).toContain('Aswan');
  });

  it('stores the LABEL as free text, so the server matches it', async () => {
    // Not the key: `north-sinai` is not something to print on a parcel, and the
    // backend sweeps KEY then LABEL across the whole table, so a label is
    // unambiguous.
    mockEffective = RATES;
    render(<CheckoutDeliveryPage />);

    const select = (await screen.findByLabelText(/governorate/i)) as HTMLSelectElement;
    await userEvent.selectOptions(select, 'giza');
    expect(select.value).toBe('giza');
    expect(within(select).getByRole('option', { name: 'Giza' })).toBeInTheDocument();
  });
});

describe('free text that matches nothing', () => {
  /**
   * The case #83 calls "the same invisible class of defect as the hardcoded
   * EGP 50 that #79 removed". A saved address holding "Cairo Governorate"
   * matches via normalisation; one holding something the admin never mapped
   * does not — and what happens then is the whole decision.
   */
  it('keeps the shopper’s own words as a selected option', async () => {
    mockEffective = RATES;
    window.sessionStorage.setItem(
      'mr-checkout',
      JSON.stringify({
        guest: {
          fullName: 'Nour Hassan',
          email: 'nour@example.com',
          phone: '01000000000',
          line1: '12 Sharia Qasr al-Nil',
          city: 'Sheikh Zayed',
          governorate: 'Sixth of October',
          postalCode: '',
        },
      }),
    );

    render(<CheckoutDeliveryPage />);

    const select = (await screen.findByLabelText(/governorate/i)) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe('__unmatched__'));

    // It is THEIR text on the option, not a generic "Other" — and it is not
    // the first option in the list, which is the silent snap this avoids.
    const chosen = within(select).getByRole('option', { selected: true });
    expect(chosen.textContent).toContain('Sixth of October');
    expect(chosen.textContent).toMatch(/not in our delivery list/i);
  });

  it('says out loud that the standard rate applies, and shows the figure', async () => {
    mockEffective = RATES;
    window.sessionStorage.setItem(
      'mr-checkout',
      JSON.stringify({
        guest: {
          fullName: 'Nour Hassan',
          email: 'nour@example.com',
          phone: '01000000000',
          line1: '12 Sharia Qasr al-Nil',
          city: 'Sheikh Zayed',
          governorate: 'Sixth of October',
        },
      }),
    );

    render(<CheckoutDeliveryPage />);

    await screen.findByLabelText(/governorate/i);
    expect(
      await screen.findByText(/not in our delivery list/i, { selector: 'span' }),
    ).toBeInTheDocument();


    // The global rate, shown as a firm number — because it IS firm: this is
    // what the server will charge for this exact text.
    await waitFor(() => expect(shippingRowText()).toContain('100'));
    expect(shippingRowText()).not.toMatch(/from/i);
  });

  it('still checks out', async () => {
    // The line that matters more than any of the copy above. An address that
    // has existed since before the rate table must not be blocked by it.
    mockEffective = RATES;
    window.sessionStorage.setItem(
      'mr-checkout',
      JSON.stringify({
        guest: {
          fullName: 'Nour Hassan',
          email: 'nour@example.com',
          phone: '01000000000',
          line1: '12 Sharia Qasr al-Nil',
          line2: '',
          city: 'Sheikh Zayed',
          governorate: 'Sixth of October',
          postalCode: '',
        },
      }),
    );

    render(<CheckoutDeliveryPage />);
    await screen.findByLabelText(/governorate/i);

    await userEvent.click(
      screen.getByRole('button', { name: /continue to payment/i }),
    );

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/checkout/payment'));

    // And the text reaches the next step unchanged — not normalised, not
    // swapped for a key, not silently replaced with the first option.
    const saved = JSON.parse(window.sessionStorage.getItem('mr-checkout') ?? '{}');
    expect(saved.guest.governorate).toBe('Sixth of October');
    expect(saved.shippingGovernorate).toBe('Sixth of October');
  });
});

describe('cash on delivery, at the address step', () => {
  /**
   * DECISION 4. `codMaxOrderMinor` gates the TOTAL and the total now moves with
   * the governorate, so the same bag allows COD in Cairo and not in Aswan. The
   * issue asks for that HERE rather than as a payment failure after the shopper
   * has filled everything in.
   *
   * Bag is EGP 450; the ceiling is EGP 500. Cairo (+60) is EGP 510 — over.
   * Wait: it is. Aswan (+120) is EGP 570 — over as well. The case that proves
   * the warning tracks the governorate rather than the bag is the mocked
   * ceiling below.
   */
  it('warns before the payment step once the governorate pushes the total over', async () => {
    mockEffective = RATES;
    render(<CheckoutDeliveryPage />);

    const select = await screen.findByLabelText(/governorate/i);

    // 450 + 60 = 510 > 500. The warning names the place, not just the number,
    // because "your order is too big" is not actionable and "Aswan costs more"
    // is.
    await userEvent.selectOptions(select, 'cairo');
    const alerts = await screen.findAllByRole('alert');
    const cod = alerts.find((a) => /cash on delivery/i.test(a.textContent ?? ''));
    expect(cod).toBeDefined();
    // It names the PLACE, not just the number: "your order is too big" is not
    // actionable, "Cairo costs more than the limit allows" is.
    expect(cod?.textContent).toContain('Cairo');
  });

  it('does not claim COD is blocked while the fee is still a floor', async () => {
    // Before a governorate is chosen the total is a LOWER BOUND, and a lower
    // bound cannot establish that a ceiling is breached. Warning on it would
    // tell some shoppers COD is unavailable when it is.
    mockEffective = {
      ...RATES,
      // A floor that alone would clear the ceiling: 450 + 60 = 510 > 500.
      minFeeCents: 6_000,
    };
    render(<CheckoutDeliveryPage />);

    await screen.findByLabelText(/governorate/i);
    expect(screen.queryByText(/not available.*cash on delivery/i)).not.toBeInTheDocument();
  });
});
