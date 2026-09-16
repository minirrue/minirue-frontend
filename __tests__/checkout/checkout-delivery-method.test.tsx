import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CheckoutDeliveryPage from '@/app/checkout/page';
import { DEFAULT_DELIVERY_SETTINGS, type DeliverySettings } from '@/lib/checkout/delivery';

/**
 * Standard / Same-day, wired into the Delivery step (frontend#163).
 *
 * `DeliveryMap` is mocked — see delivery-method-step.test.tsx for why — so
 * these tests exercise the choice, the block-on-no-choice, and the
 * block-on-no-location rules without ever loading real Leaflet.
 */
jest.mock('@/components/checkout/DeliveryMap', () => ({
  __esModule: true,
  default: ({ onChange }: { onChange: (pin: { lat: number; lng: number }) => void }) => (
    <button type="button" onClick={() => onChange({ lat: 30.05, lng: 31.24 })}>
      mock-map-drop-pin
    </button>
  ),
}));

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, prefetch: jest.fn() }),
}));

const mockUseUser = jest.fn();
jest.mock('@/lib/hooks/use-auth', () => ({
  useUser: () => mockUseUser(),
}));

const mockUseCustomerAddresses = jest.fn();
jest.mock('@/lib/hooks/use-customer', () => ({
  useCustomerAddresses: () => mockUseCustomerAddresses(),
  useUpdateCustomerAddress: () => ({ mutateAsync: jest.fn() }),
}));

jest.mock('@/components/storefront/cart/CartContext', () => ({
  useCart: () => ({
    cartId: '11111111-1111-4111-8111-111111111111',
    itemCount: 1,
    subtotalAmount: '450.00',
    currency: 'EGP',
  }),
}));

jest.mock('@/components/checkout/CheckoutShell', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

/** Same-day enabled for CAIRO, otherwise the shop's defaults. */
const SAME_DAY_SETTINGS: DeliverySettings = {
  ...DEFAULT_DELIVERY_SETTINGS,
  sameDay: { ...DEFAULT_DELIVERY_SETTINGS.sameDay, enabled: true, governorates: ['CAIRO'] },
};

const mockLoadDeliverySettings = jest.fn();
jest.mock('@/lib/api/settings', () => ({
  ...jest.requireActual('@/lib/api/settings'),
  loadDeliverySettings: (...args: unknown[]) => mockLoadDeliverySettings(...args),
}));

async function fillGuestBasics(user: ReturnType<typeof userEvent.setup>, governorate: string) {
  await user.type(screen.getByLabelText(/full name/i), 'Volta Joe');
  await user.type(screen.getByLabelText(/^email$/i), 'volta@example.com');
  await user.type(screen.getByLabelText(/^phone$/i), '+201012431350');
  await user.type(screen.getByLabelText(/^address$/i), '12 Nile Street');
  await user.type(screen.getByLabelText(/^city$/i), 'Al Giza');
  // The governorate field is a closed-list `<select>` since frontend#158 —
  // select by its visible English label, not typed text.
  await user.selectOptions(screen.getByLabelText(/^governorate$/i), governorate);
}

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();
  mockUseUser.mockReturnValue({ data: undefined, isPending: false });
  mockUseCustomerAddresses.mockReturnValue({ data: undefined, isLoading: true });
  mockLoadDeliverySettings.mockResolvedValue(DEFAULT_DELIVERY_SETTINGS);
});

describe('checkout delivery step — Standard / Same-day (frontend#163)', () => {
  it('auto-selects Standard and continues normally when the shop has no same-day settings', async () => {
    const user = userEvent.setup();
    render(<CheckoutDeliveryPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    });
    await fillGuestBasics(user, 'Giza');

    await waitFor(() => {
      expect(
        screen.getByText(/only standard delivery is available for this governorate/i),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /continue to payment/i }));

    expect(mockPush).toHaveBeenCalledWith('/checkout/payment');
    const saved = JSON.parse(window.sessionStorage.getItem('mr-checkout') ?? '{}');
    expect(saved.deliveryMethod).toBe('STANDARD');
    expect(saved.deliveryLocation).toBeUndefined();
  });

  it('blocks continuing with no delivery method chosen once Same-day is offered', async () => {
    mockLoadDeliverySettings.mockResolvedValue(SAME_DAY_SETTINGS);
    const user = userEvent.setup();
    render(<CheckoutDeliveryPage />);

    await waitFor(() => expect(screen.getByLabelText(/full name/i)).toBeInTheDocument());
    await fillGuestBasics(user, 'Cairo');

    await waitFor(() => {
      expect(screen.getByText('Same-day delivery')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /continue to payment/i }));

    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByText(/choose a delivery method before continuing/i)).toBeInTheDocument();
  });

  it('blocks continuing on Same-day with no usable location, then continues once one is added', async () => {
    mockLoadDeliverySettings.mockResolvedValue(SAME_DAY_SETTINGS);
    const user = userEvent.setup();
    render(<CheckoutDeliveryPage />);

    await waitFor(() => expect(screen.getByLabelText(/full name/i)).toBeInTheDocument());
    await fillGuestBasics(user, 'Cairo');

    await waitFor(() => expect(screen.getByText('Same-day delivery')).toBeInTheDocument());
    await user.click(screen.getByRole('radio', { name: /same-day delivery/i }));

    await user.click(screen.getByRole('button', { name: /continue to payment/i }));
    expect(mockPush).not.toHaveBeenCalled();
    expect(
      screen.getByText(/add your delivery location.*drop a pin.*use your location.*paste a google maps link/i),
    ).toBeInTheDocument();

    await user.click(screen.getByText('mock-map-drop-pin'));
    await user.click(screen.getByRole('button', { name: /continue to payment/i }));

    expect(mockPush).toHaveBeenCalledWith('/checkout/payment');
    const saved = JSON.parse(window.sessionStorage.getItem('mr-checkout') ?? '{}');
    expect(saved.deliveryMethod).toBe('SAME_DAY');
    expect(saved.deliveryLocation).toEqual({ lat: 30.05, lng: 31.24 });
  });

  it('resolves a pasted Google Maps link as the location when no pin is dropped', async () => {
    mockLoadDeliverySettings.mockResolvedValue(SAME_DAY_SETTINGS);
    const user = userEvent.setup();
    render(<CheckoutDeliveryPage />);

    await waitFor(() => expect(screen.getByLabelText(/full name/i)).toBeInTheDocument());
    await fillGuestBasics(user, 'Cairo');

    await waitFor(() => expect(screen.getByText('Same-day delivery')).toBeInTheDocument());
    await user.click(screen.getByRole('radio', { name: /same-day delivery/i }));

    await user.type(
      screen.getByLabelText(/paste a google maps link/i),
      'https://maps.google.com/maps?q=30.05,31.24',
    );

    await user.click(screen.getByRole('button', { name: /continue to payment/i }));

    expect(mockPush).toHaveBeenCalledWith('/checkout/payment');
    const saved = JSON.parse(window.sessionStorage.getItem('mr-checkout') ?? '{}');
    expect(saved.deliveryMethod).toBe('SAME_DAY');
    expect(saved.deliveryLocation).toEqual({ lat: 30.05, lng: 31.24 });
  });
});
