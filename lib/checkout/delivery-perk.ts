import type { EffectiveShipping } from './governorate-rates';

/**
 * The product page's delivery promise, written from the shop's real shipping
 * settings (#162).
 *
 * It used to be free text under Storefront → Product section, and it drifted:
 * the page promised "FREE shipping over EGP 2000" while the shipping settings
 * had no threshold and checkout charged EGP 100 on every order. The line is
 * now derived from the same published policy checkout uses, so it cannot say
 * anything checkout does not do.
 */
export function deliveryPerkText(s: EffectiveShipping | null): string {
  // Not loaded yet (server render, first paint): no number at all. The code's
  // fallback fee is not the shop's fee, and a wrong one in the HTML is what
  // Google would index.
  if (!s) return 'Delivery across Egypt';
  const egp = (cents: number) => `EGP ${Math.round(cents / 100).toLocaleString('en-US')}`;
  if (s.freeOverCents > 0) {
    return `Free delivery across Egypt over ${egp(s.freeOverCents)}`;
  }
  if (s.minFeeCents <= 0) return 'Free delivery across Egypt';
  const fees = [s.flatRateCents, ...s.rates.filter((r) => r.enabled).map((r) => r.feeCents)];
  const varies = fees.some((f) => f !== s.minFeeCents);
  return varies
    ? `Delivery across Egypt from ${egp(s.minFeeCents)}`
    : `Delivery across Egypt · ${egp(s.minFeeCents)}`;
}

/** The perk that talks about delivery: its stored text is replaced by the derived line. */
export function isDeliveryPerk(perk: { id: string; icon: string }): boolean {
  return perk.id === 'perk-shipping' || perk.icon === 'truck';
}
