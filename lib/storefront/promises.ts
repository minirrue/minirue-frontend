/**
 * The product page's promises (#189, owner 2026-09-20: "anything created
 * advertised must be controlled 100% dynamically from dashboard").
 *
 * The words belong to the dashboard. This file only decides whether a promise
 * is ALLOWED to appear — by checking the same live settings checkout uses —
 * and fills the owner's own tokens with real values. Nothing here writes a
 * sentence; a promise whose condition is false, or whose token has no value,
 * is dropped rather than softened, because a claim the data cannot back is
 * worse than a shorter list.
 */

import type { ProductPerk } from '@/lib/api/storefront';

/** What the shop can prove right now, read from live settings by the caller. */
export interface PromiseFacts {
  /** Free everywhere the shop delivers. */
  freeEverywhere: boolean;
  /** Named governorates that are free when it is not free everywhere. */
  freeGovernorates: string[];
  /** Named governorates offering same-day, empty when it is off. */
  sameDayGovernorates: string[];
  /** Cash on delivery available for THIS product's price. */
  codAvailable: boolean;
  /** The shop's cash-on-delivery ceiling, already formatted (e.g. "EGP 10,000"). */
  codLimit: string | null;
  /** The delivery estimate the shipping settings publish (e.g. "2–5 working days"). */
  deliveryDays: string | null;
  /** The returns window in days, when the owner has set one. */
  returnsDays: number | null;
  /** The delivery fee, already formatted; null when free. */
  fee: string | null;
  /** Whether this product has any published review. */
  hasReviews: boolean;
}

export interface ResolvedPromise {
  id: string;
  icon: ProductPerk['icon'];
  text: string;
}

/** Joins names the way a person would: "Cairo and Giza", "Cairo, Giza and Alexandria". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function conditionHolds(perk: ProductPerk, facts: PromiseFacts): boolean {
  switch (perk.showWhen ?? 'always') {
    case 'freeShipping':
      return facts.freeEverywhere || facts.freeGovernorates.length > 0;
    case 'sameDay':
      return facts.sameDayGovernorates.length > 0;
    case 'cod':
      return facts.codAvailable;
    case 'returns':
      return (facts.returnsDays ?? 0) > 0;
    case 'reviews':
      return facts.hasReviews;
    case 'always':
    default:
      return true;
  }
}

/** The owner's tokens, and the only values that may fill them. */
function tokenValue(token: string, facts: PromiseFacts): string | null {
  switch (token) {
    case 'deliveryDays':
      return facts.deliveryDays;
    case 'freeGovernorates':
      return facts.freeEverywhere ? 'Egypt' : facts.freeGovernorates.length ? joinNames(facts.freeGovernorates) : null;
    case 'sameDayGovernorates':
      return facts.sameDayGovernorates.length ? joinNames(facts.sameDayGovernorates) : null;
    case 'codLimit':
      return facts.codLimit;
    case 'returnsDays':
      return facts.returnsDays ? String(facts.returnsDays) : null;
    case 'fee':
      return facts.fee;
    default:
      return null;
  }
}

const TOKEN = /\{(\w+)\}/g;

/**
 * Fills `{tokens}` from the facts. Returns null when any token in the text has
 * no value — a half-written promise ("Free delivery in ") never reaches a
 * customer.
 */
export function fillTokens(text: string, facts: PromiseFacts): string | null {
  let missing = false;
  const filled = text.replace(TOKEN, (_match, token: string) => {
    const value = tokenValue(token, facts);
    if (value === null) {
      missing = true;
      return '';
    }
    return value;
  });
  if (missing) return null;
  const trimmed = filled.replace(/\s+/g, ' ').trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * The promises this product page may show, in the owner's order. Disabled
 * rows, unproven conditions and unfillable text all drop out silently.
 */
export function resolvePromises(perks: ProductPerk[] | undefined, facts: PromiseFacts): ResolvedPromise[] {
  if (!perks?.length) return [];
  return perks
    .map((perk, index) => ({ perk, index }))
    .filter(({ perk }) => perk.enabled !== false)
    .filter(({ perk }) => conditionHolds(perk, facts))
    .sort((a, b) => (a.perk.order ?? a.index) - (b.perk.order ?? b.index))
    .map(({ perk }) => {
      const text = fillTokens(perk.text, facts);
      return text ? { id: perk.id, icon: perk.icon, text } : null;
    })
    .filter((p): p is ResolvedPromise => p !== null);
}
