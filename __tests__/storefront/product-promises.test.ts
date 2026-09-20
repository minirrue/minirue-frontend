import { describe, expect, it } from '@jest/globals';
import { fillTokens, joinNames, resolvePromises, type PromiseFacts } from '@/lib/storefront/promises';
import type { ProductPerk } from '@/lib/api/storefront';

const FACTS: PromiseFacts = {
  freeEverywhere: true,
  freeGovernorates: [],
  sameDayGovernorates: ['Cairo', 'Giza'],
  codAvailable: true,
  codLimit: 'EGP 10,000',
  deliveryDays: '2–5 working days',
  returnsDays: null,
  fee: null,
  hasReviews: false,
};

const perk = (over: Partial<ProductPerk>): ProductPerk => ({ id: 'p', icon: 'truck', text: 'Promise', ...over });

/**
 * The owner writes the words; the settings decide whether they may be shown
 * (#189). A claim the data cannot back must never reach a customer.
 */
describe('product promises', () => {
  it('shows a promise only when its condition holds', () => {
    const perks = [
      perk({ id: 'free', showWhen: 'freeShipping', text: 'Free delivery' }),
      perk({ id: 'sameday', showWhen: 'sameDay', text: 'Same-day delivery' }),
      perk({ id: 'returns', showWhen: 'returns', text: '14-day returns' }),
      perk({ id: 'reviews', showWhen: 'reviews', text: 'Loved by shoppers' }),
    ];
    expect(resolvePromises(perks, FACTS).map((p) => p.id)).toEqual(['free', 'sameday']);
  });

  it('never advertises same-day when no governorate offers it', () => {
    const facts = { ...FACTS, sameDayGovernorates: [] };
    expect(resolvePromises([perk({ id: 's', showWhen: 'sameDay' })], facts)).toEqual([]);
  });

  it('fills the owner tokens from live settings', () => {
    expect(fillTokens('Same-day in {sameDayGovernorates}', FACTS)).toBe('Same-day in Cairo and Giza');
    expect(fillTokens('Free delivery across {freeGovernorates}', FACTS)).toBe('Free delivery across Egypt');
    expect(fillTokens('Arrives in {deliveryDays}', FACTS)).toBe('Arrives in 2–5 working days');
  });

  it('drops a promise whose token has no value rather than printing half a sentence', () => {
    expect(fillTokens('{returnsDays}-day returns', FACTS)).toBeNull();
    expect(resolvePromises([perk({ id: 'r', text: '{returnsDays}-day returns' })], FACTS)).toEqual([]);
  });

  it('respects enabled and order', () => {
    const perks = [
      perk({ id: 'second', text: 'Second', order: 2 }),
      perk({ id: 'hidden', text: 'Hidden', enabled: false }),
      perk({ id: 'first', text: 'First', order: 1 }),
    ];
    expect(resolvePromises(perks, FACTS).map((p) => p.id)).toEqual(['first', 'second']);
  });

  it('reads cash on delivery per product price, not as a shop-wide flag', () => {
    const perks = [perk({ id: 'cod', showWhen: 'cod', text: 'Cash on delivery' })];
    expect(resolvePromises(perks, FACTS)).toHaveLength(1);
    expect(resolvePromises(perks, { ...FACTS, codAvailable: false })).toEqual([]);
  });

  it('joins names the way a person would', () => {
    expect(joinNames(['Cairo'])).toBe('Cairo');
    expect(joinNames(['Cairo', 'Giza'])).toBe('Cairo and Giza');
    expect(joinNames(['Cairo', 'Giza', 'Alexandria'])).toBe('Cairo, Giza and Alexandria');
  });

  it('renders nothing when the dashboard has no promises', () => {
    expect(resolvePromises([], FACTS)).toEqual([]);
    expect(resolvePromises(undefined, FACTS)).toEqual([]);
  });
});
