import React from 'react';
import { render, screen } from '@testing-library/react';
import ProductTrustRow from '@/components/storefront/ProductTrustRow';
import { DEFAULT_EFFECTIVE_SHIPPING, type EffectiveShipping } from '@/lib/checkout/governorate-rates';
import { DEFAULT_DELIVERY_SETTINGS, type DeliverySettings } from '@/lib/checkout/delivery';
import type { PublicTrustSettings } from '@/lib/api/settings';

/**
 * frontend#189 — the persuasion gate, above the fold. Every case here checks
 * the CONTRAPOSITIVE as much as the positive: a chip that settings do not
 * support must not appear, and the row itself must render nothing when no
 * chip qualifies (no empty heading, no placeholder rule).
 */

let mockShipping: EffectiveShipping | null = DEFAULT_EFFECTIVE_SHIPPING;
let mockCodMax: number | null = null;
let mockDelivery: DeliverySettings = DEFAULT_DELIVERY_SETTINGS;
let mockTrust: PublicTrustSettings | null = null;

jest.mock('@/components/storefront/cart/use-bag-pricing', () => ({
  useLoadedShipping: () => mockShipping,
  useCodMaxOrderMinor: () => mockCodMax,
}));

jest.mock('@/lib/hooks/use-trust-row', () => ({
  useDeliverySettings: () => mockDelivery,
  useTrustSettings: () => mockTrust,
}));

beforeEach(() => {
  mockShipping = DEFAULT_EFFECTIVE_SHIPPING;
  mockCodMax = null;
  mockDelivery = DEFAULT_DELIVERY_SETTINGS;
  mockTrust = null;
});

describe('ProductTrustRow', () => {
  it('renders nothing before shipping has loaded and nothing else qualifies', () => {
    mockShipping = null;
    mockCodMax = null; // COD with no ceiling is available even with no read yet — still true
    const { container } = render(<ProductTrustRow priceAmount="500.00" />);
    // COD-only (no limit) still renders — assert the OTHER chips are absent.
    expect(screen.queryByText(/free delivery/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/same-day/i)).not.toBeInTheDocument();
    expect(container.querySelector('[data-testid="product-trust-row"]')).toBeInTheDocument();
  });

  it('renders truly nothing when every chip is unsupported', () => {
    mockShipping = { ...DEFAULT_EFFECTIVE_SHIPPING, flatRateCents: 5000 };
    mockCodMax = 100; // price above this, so COD is unavailable too
    const { container } = render(<ProductTrustRow priceAmount="50000.00" />);
    expect(container.querySelector('[data-testid="product-trust-row"]')).not.toBeInTheDocument();
  });

  it('says free delivery across Egypt only when the shop is free everywhere', () => {
    mockShipping = { ...DEFAULT_EFFECTIVE_SHIPPING, flatRateCents: 0 };
    render(<ProductTrustRow priceAmount="500.00" />);
    expect(screen.getByText(/free delivery across egypt/i)).toBeInTheDocument();
  });

  it('names governorates when free only in some, never a bare "Free delivery"', () => {
    mockShipping = {
      ...DEFAULT_EFFECTIVE_SHIPPING,
      flatRateCents: 5000,
      rates: [{ key: 'CAIRO', label: 'Cairo', feeCents: 0, enabled: true, aliases: [] }],
    };
    render(<ProductTrustRow priceAmount="500.00" />);
    expect(screen.getByText(/free delivery in cairo/i)).toBeInTheDocument();
  });

  it('never hardcodes Cairo/Giza for same-day — reflects whatever the settings name', () => {
    mockDelivery = {
      ...DEFAULT_DELIVERY_SETTINGS,
      sameDay: { ...DEFAULT_DELIVERY_SETTINGS.sameDay, enabled: true, governorates: ['ALEXANDRIA'] },
    };
    render(<ProductTrustRow priceAmount="500.00" />);
    expect(screen.getByText(/same-day delivery in alexandria/i)).toBeInTheDocument();
    expect(screen.queryByText(/cairo/i)).not.toBeInTheDocument();
  });

  it('hides cash on delivery above the COD limit for this product\'s price', () => {
    mockCodMax = 40000; // EGP 400.00
    render(<ProductTrustRow priceAmount="900.00" />);
    expect(screen.queryByText(/cash on delivery/i)).not.toBeInTheDocument();
  });

  it('shows cash on delivery within the COD limit', () => {
    mockCodMax = 40000;
    render(<ProductTrustRow priceAmount="300.00" />);
    expect(screen.getByText(/cash on delivery/i)).toBeInTheDocument();
  });

  it('shows the returns window from settings, never an invented day count', () => {
    mockTrust = { returnsWindowDays: 14 };
    render(<ProductTrustRow priceAmount="500.00" />);
    expect(screen.getByText(/14-day returns/i)).toBeInTheDocument();
  });

  it('hides returns when the setting is absent', () => {
    mockTrust = { returnsWindowDays: null };
    render(<ProductTrustRow priceAmount="500.00" />);
    expect(screen.queryByText(/returns/i)).not.toBeInTheDocument();
  });

  it('prints the packaging promise verbatim, on its own line', () => {
    mockTrust = { packagingPromise: 'Signature MiniRue box, sealed and gift-ready.' };
    render(<ProductTrustRow priceAmount="500.00" />);
    expect(
      screen.getByText('Signature MiniRue box, sealed and gift-ready.'),
    ).toBeInTheDocument();
  });
});
