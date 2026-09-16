import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CheckoutDeliveryPage from '@/app/checkout/page';
import type { EffectiveShipping } from '@/lib/checkout/governorate-rates';
import { DEFAULT_EFFECTIVE_SHIPPING } from '@/lib/checkout/governorate-rates';

/**
 * #83 + #158/#163 — the governorate field, on the storefront.
 *
 * This file used to pin `GovernorateSelect` (components/checkout/GovernorateSelect.tsx),
 * a free-text box that upgraded to a `<select>` sourced from the admin's
 * per-governorate rate TABLE, with an unmatched value kept verbatim as a
 * fallback option. Frontend#158/#163 retired that widget for the guest
 * checkout field specifically: the governorate is now always one of the 27
 * CLOSED keys (`lib/checkout/governorates.ts`), via `GovernorateKeySelect`,
 * independent of whatever the admin's rate table does or does not contain —
 * free text is gone, full stop. That change closed a live production
 * incident (a guest's raw typed text, "1111111", reaching checkout as the
 * governorate and being rejected by the backend's enum validation).
 *
 * These cases now pin:
 *
 *  1. the field is ALWAYS the closed 27-key select — with a rate table
 *     published or not, and whether or not a given key has its own rate row;
 *  2. the summary still follows the selected governorate, because the rate
 *     table lookup (#83) is unchanged — only the INPUT widget that feeds it
 *     changed, from free text to a closed key;
 *  3. a session left over from before this shipped, carrying legacy free
 *     text that does not resolve to any of the 27 keys, is never silently
 *     kept — the shopper is forced to pick a real governorate before they
 *     can continue.
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
  useUpdateCustomerAddress: () => ({ mutateAsync: jest.fn() }),
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

const mockLoadDeliverySettings = jest.fn();
jest.mock('@/lib/api/settings', () => ({
  ...jest.requireActual('@/lib/api/settings'),
  loadDeliverySettings: (...args: unknown[]) => mockLoadDeliverySettings(...args),
}));

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
// A limit an admin set; `null` is no limit (minirue-backend#105).
let mockCodLimit: number | null = 50_000;
jest.mock('@/components/storefront/cart/use-bag-pricing', () => ({
  useEffectiveShipping: () => mockEffective,
  useCodMaxOrderMinor: () => mockCodLimit,
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
  mockLoadDeliverySettings.mockResolvedValue({
    standard: { enabled: true, etaLabel: '2–5 working days' },
    sameDay: {
      enabled: false,
      governorates: [],
      windowStart: '19:00',
      windowEnd: '24:00',
      cutoff: '17:00',
      feeRangeMinor: { min: 9000, max: 16000 },
      disclaimer: '',
      timezone: 'Africa/Cairo',
    },
  });
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

describe('the governorate field is the closed 27-key select (#158/#163)', () => {
  it('is a SELECT of all 27 governorates, with a rate table published', async () => {
    mockEffective = RATES;
    render(<CheckoutDeliveryPage />);

    const select = await screen.findByLabelText(/governorate/i);
    expect(select.tagName).toBe('SELECT');

    const options = within(select as HTMLSelectElement)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options).toEqual(
      expect.arrayContaining(['Cairo', 'Giza', 'Aswan', 'North Sinai']),
    );
  });

  it('offers a governorate even when its OWN rate row is disabled', async () => {
    // The closed enum is independent of the admin's rate table (#158): a
    // disabled row still means "no special price", never "not deliverable".
    // The old widget hid it from the picker; this one never does, and the
    // global rate applies (DECISION 3 of #83, unchanged).
    mockEffective = RATES;
    render(<CheckoutDeliveryPage />);

    const select = await screen.findByLabelText(/governorate/i);
    expect(
      within(select as HTMLSelectElement).getByRole('option', { name: 'North Sinai' }),
    ).toBeInTheDocument();
  });

  it('is still a SELECT of all 27 governorates when the shop publishes no table', async () => {
    // Every deploy today. Unlike the retired widget, there is no free-text
    // fallback any more — the closed enum applies with or without a table.
    mockEffective = DEFAULT_EFFECTIVE_SHIPPING;
    render(<CheckoutDeliveryPage />);

    const select = await screen.findByLabelText(/governorate/i);
    expect(select.tagName).toBe('SELECT');
    expect(
      within(select as HTMLSelectElement).getAllByRole('option').length,
    ).toBeGreaterThanOrEqual(27);
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

    await userEvent.selectOptions(select, 'Cairo');
    await waitFor(() => expect(shippingRowText()).toContain('60'));
    expect(shippingRowText()).not.toMatch(/from/i);
    expect(shippingRowText()).toContain('Cairo');

    await userEvent.selectOptions(select, 'Aswan');
    await waitFor(() => expect(shippingRowText()).toContain('120'));
    expect(shippingRowText()).toContain('Aswan');
  });

  it('stores the closed KEY, not free text', async () => {
    // Frontend#158: the value the guest's governorate field carries — and
    // sends to checkout — is now the enum key, e.g. "GIZA", never a label.
    mockEffective = RATES;
    render(<CheckoutDeliveryPage />);

    const select = (await screen.findByLabelText(/governorate/i)) as HTMLSelectElement;
    await userEvent.selectOptions(select, 'Giza');
    expect(select.value).toBe('GIZA');
  });
});

describe('a legacy session with an unmatched governorate (pre-#158)', () => {
  /**
   * The case this closed: a session saved before #158 shipped (or a stale
   * tab) can still carry free text — "Sixth of October" is a real place, but
   * not one of the 27 governorate keys. The old widget kept it as a visible,
   * checkout-able "Other" option. The new one never does: the select simply
   * shows no selection, and `validateGuest` (now `resolveGovernorateKey`-
   * backed, not a length check) blocks Continue until a real key is picked.
   */
  it('renders with nothing selected, rather than keeping the stale text', async () => {
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
    await waitFor(() => expect(select.value).toBe(''));
  });

  it('blocks Continue until a real governorate is chosen, then proceeds', async () => {
    const user = userEvent.setup();
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
    const select = (await screen.findByLabelText(/governorate/i)) as HTMLSelectElement;

    await user.click(screen.getByRole('button', { name: /continue to payment/i }));
    expect(mockPush).not.toHaveBeenCalledWith('/checkout/payment');
    expect(await screen.findByText(/select your governorate/i)).toBeInTheDocument();

    await user.selectOptions(select, 'Giza');
    await user.click(screen.getByRole('button', { name: /continue to payment/i }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/checkout/payment'));

    const saved = JSON.parse(window.sessionStorage.getItem('mr-checkout') ?? '{}');
    expect(saved.guest.governorate).toBe('GIZA');
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
  afterEach(() => {
    mockCodLimit = 50_000;
  });

  it('warns before the payment step once the governorate pushes the total over', async () => {
    mockEffective = RATES;
    render(<CheckoutDeliveryPage />);

    const select = await screen.findByLabelText(/governorate/i);

    // 450 + 60 = 510 > 500. The warning names the place, not just the number,
    // because "your order is too big" is not actionable and "Aswan costs more"
    // is.
    await userEvent.selectOptions(select, 'Cairo');
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

  it('never warns when the shop has set no COD limit — the default', async () => {
    // minirue-backend#105: the limit used to be a hard-coded EGP 500, so this
    // same bag was always refused. With no limit set, COD is allowed at any
    // total, whichever governorate is chosen.
    mockEffective = RATES;
    mockCodLimit = null;
    render(<CheckoutDeliveryPage />);

    const select = await screen.findByLabelText(/governorate/i);
    await userEvent.selectOptions(select, 'Cairo');
    await waitFor(() => expect(select).toHaveValue('CAIRO'));
    // The same selection renders the COD alert within this window when a limit
    // IS set (the first test above), so its absence here is not a timing fluke.
    await new Promise((resolve) => setTimeout(resolve, 100));
    const alerts = screen.queryAllByRole('alert');
    expect(alerts.find((a) => /cash on delivery/i.test(a.textContent ?? ''))).toBeUndefined();
  });
});
