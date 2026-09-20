import {
  resolveFreeDelivery,
  resolveSameDayGovernorates,
  resolveCodAvailable,
} from '@/lib/checkout/trust-row';
import { DEFAULT_EFFECTIVE_SHIPPING, type EffectiveShipping } from '@/lib/checkout/governorate-rates';
import { DEFAULT_DELIVERY_SETTINGS, type DeliverySettings } from '@/lib/checkout/delivery';

/**
 * frontend#189 — the trust row's derivations, tested the same way
 * governorate-rates.test.ts pins the mirror: settings in, a fact out, no
 * network and no React.
 */

describe('resolveFreeDelivery', () => {
  it('is null when nothing is free', () => {
    const effective: EffectiveShipping = { ...DEFAULT_EFFECTIVE_SHIPPING, flatRateCents: 5000 };
    expect(resolveFreeDelivery(effective)).toBeNull();
  });

  it('is allFree when the flat rate is zero and nothing overrides it upward', () => {
    const effective: EffectiveShipping = { ...DEFAULT_EFFECTIVE_SHIPPING, flatRateCents: 0 };
    expect(resolveFreeDelivery(effective)).toEqual({ allFree: true, governorateLabels: [] });
  });

  it('names the governorates when free only in some, not a bare "Free delivery"', () => {
    const effective: EffectiveShipping = {
      ...DEFAULT_EFFECTIVE_SHIPPING,
      flatRateCents: 5000,
      rates: [
        { key: 'CAIRO', label: 'Cairo', feeCents: 0, enabled: true, aliases: [] },
        { key: 'GIZA', label: 'Giza', feeCents: 0, enabled: true, aliases: [] },
        { key: 'ASWAN', label: 'Aswan', feeCents: 10000, enabled: true, aliases: [] },
      ],
    };
    expect(resolveFreeDelivery(effective)).toEqual({
      allFree: false,
      governorateLabels: ['Cairo', 'Giza'],
    });
  });

  it('a disabled zero-fee row does not count — it is billed the global rate', () => {
    const effective: EffectiveShipping = {
      ...DEFAULT_EFFECTIVE_SHIPPING,
      flatRateCents: 5000,
      rates: [{ key: 'CAIRO', label: 'Cairo', feeCents: 0, enabled: false, aliases: [] }],
    };
    expect(resolveFreeDelivery(effective)).toBeNull();
  });

  it('a flat rate of zero with a paid override somewhere makes no claim at all, rather than enumerate 26 unlisted governorates as "free"', () => {
    const effective: EffectiveShipping = {
      ...DEFAULT_EFFECTIVE_SHIPPING,
      flatRateCents: 0,
      rates: [{ key: 'ASWAN', label: 'Aswan', feeCents: 10000, enabled: true, aliases: [] }],
    };
    expect(resolveFreeDelivery(effective)).toBeNull();
  });
});

describe('resolveSameDayGovernorates', () => {
  it('is empty when same-day is off', () => {
    expect(resolveSameDayGovernorates(DEFAULT_DELIVERY_SETTINGS)).toEqual([]);
  });

  it('names exactly the governorates the settings name — never a hardcoded pair', () => {
    const settings: DeliverySettings = {
      ...DEFAULT_DELIVERY_SETTINGS,
      sameDay: { ...DEFAULT_DELIVERY_SETTINGS.sameDay, enabled: true, governorates: ['CAIRO', 'GIZA'] },
    };
    expect(resolveSameDayGovernorates(settings)).toEqual(['Cairo', 'Giza']);
  });

  it('reflects a single-governorate shop, not just the Cairo/Giza case', () => {
    const settings: DeliverySettings = {
      ...DEFAULT_DELIVERY_SETTINGS,
      sameDay: { ...DEFAULT_DELIVERY_SETTINGS.sameDay, enabled: true, governorates: ['ALEXANDRIA'] },
    };
    expect(resolveSameDayGovernorates(settings)).toEqual(['Alexandria']);
  });

  it('is empty when enabled but no governorate is named', () => {
    const settings: DeliverySettings = {
      ...DEFAULT_DELIVERY_SETTINGS,
      sameDay: { ...DEFAULT_DELIVERY_SETTINGS.sameDay, enabled: true, governorates: [] },
    };
    expect(resolveSameDayGovernorates(settings)).toEqual([]);
  });
});

describe('resolveCodAvailable', () => {
  it('is true with no limit set', () => {
    expect(resolveCodAvailable('500.00', null)).toBe(true);
  });

  it('is false above the shop\'s own COD ceiling', () => {
    expect(resolveCodAvailable('900.00', 50000)).toBe(false);
  });

  it('is true at or under the ceiling (shipping is added, so the price alone must leave room for it)', () => {
    expect(resolveCodAvailable('400.00', 50000)).toBe(true);
  });
});
