import { deliveryPerkText, isDeliveryPerk } from '@/lib/checkout/delivery-perk';
import { DEFAULT_EFFECTIVE_SHIPPING, type EffectiveShipping } from '@/lib/checkout/governorate-rates';

/** #162: the delivery perk is derived from the shipping policy, never free text. */
const policy = (over: Partial<EffectiveShipping>): EffectiveShipping => ({
  ...DEFAULT_EFFECTIVE_SHIPPING,
  ...over,
});
const rate = (key: string, feeCents: number, enabled = true) => ({
  key,
  label: key,
  feeCents,
  enabled,
  aliases: [],
});

describe('deliveryPerkText', () => {
  it("today's shop: flat EGP 100, no threshold → never promises free delivery", () => {
    const text = deliveryPerkText(policy({ flatRateCents: 10000, freeOverCents: 0, minFeeCents: 10000 }));
    expect(text).toBe('Delivery across Egypt · EGP 100');
    expect(text).not.toMatch(/free/i);
  });

  it('a real threshold is quoted from the setting', () => {
    expect(deliveryPerkText(policy({ freeOverCents: 200000 }))).toBe(
      'Free delivery across Egypt over EGP 2,000',
    );
  });

  it('per-governorate fees → "from" the cheapest enabled fee', () => {
    const s = policy({
      flatRateCents: 10000,
      minFeeCents: 8000,
      rates: [rate('CAIRO', 8000), rate('ASWAN', 15000), rate('SINAI', 5000, false)],
    });
    expect(deliveryPerkText(s)).toBe('Delivery across Egypt from EGP 80');
  });

  it('a zero fee everywhere is free delivery', () => {
    expect(deliveryPerkText(policy({ flatRateCents: 0, minFeeCents: 0 }))).toBe('Free delivery across Egypt');
  });
});

describe('isDeliveryPerk', () => {
  it('matches the shipping perk by id or truck icon only', () => {
    expect(isDeliveryPerk({ id: 'perk-shipping', icon: 'gift' })).toBe(true);
    expect(isDeliveryPerk({ id: 'x', icon: 'truck' })).toBe(true);
    expect(isDeliveryPerk({ id: 'perk-samples', icon: 'gift' })).toBe(false);
  });
});
