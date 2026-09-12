import {
  DEFAULT_EFFECTIVE_SHIPPING,
  FREE_SHIPPING_BEATS_GOVERNORATE_RATE,
  minFeeCentsFor,
  normaliseGovernorate,
  quoteShipping,
  resolveGovernorateRate,
  resolveGovernorateRates,
  selectableRates,
  type EffectiveShipping,
  type GovernorateRate,
} from '@/lib/checkout/governorate-rates';
import { shippingSummary } from '@/lib/checkout/shipping-summary';
import { resolveEffectiveShipping } from '@/lib/api/settings';

/**
 * #83 — per-governorate delivery rates, on the storefront side.
 *
 * These cases exist because `lib/checkout/governorate-rates.ts` is a HAND-COPY
 * of the backend's `src/settings/shipping-policy.ts`. A copy is only as good as
 * the thing that notices when it stops agreeing, and there is no shared package
 * and no contract test across the two repos — so this file is the only thing
 * standing between "the cart says 50" and "the invoice says 120".
 *
 * Every expectation below is therefore written as an assertion about the
 * BACKEND's behaviour, not about this module's. If one of them starts failing
 * after a backend change, the fix is to re-copy, not to edit the number.
 */

const rate = (over: Partial<GovernorateRate> = {}): GovernorateRate => ({
  key: 'cairo',
  label: 'Cairo',
  feeCents: 6_000,
  enabled: true,
  aliases: [],
  ...over,
});

const effectiveWith = (over: Partial<EffectiveShipping> = {}): EffectiveShipping => ({
  ...DEFAULT_EFFECTIVE_SHIPPING,
  flatRateCents: 10_000,
  minFeeCents: 10_000,
  ...over,
});

// The shop as it is actually configured today, read off the live
// `GET /v1/settings/public` on 2026-09-12: EGP 100 flat, no threshold, and an
// EMPTY rate table. Anything that regresses this regresses the live shop.
const LIVE_TODAY: EffectiveShipping = effectiveWith({ rates: [], freeOverCents: 0 });

describe('normaliseGovernorate', () => {
  it('folds the spellings one place is stored under', () => {
    // The exact list from the issue: live rows hold all of these.
    const cairo = normaliseGovernorate('Cairo');
    expect(normaliseGovernorate('cairo')).toBe(cairo);
    expect(normaliseGovernorate('  CAIRO  ')).toBe(cairo);
    expect(normaliseGovernorate('Cairo Governorate')).toBe(cairo);
    expect(normaliseGovernorate('Cairo governate')).toBe(cairo);
    expect(normaliseGovernorate('Cairo gov')).toBe(cairo);
    expect(normaliseGovernorate('Cairo.')).toBe(cairo);
  });

  it('folds the Arabic forms Egyptian shoppers type interchangeably', () => {
    // ة vs ه is the difference between القاهرة and القاهره being one place and
    // being two, only one of which would have a rate.
    expect(normaliseGovernorate('القاهرة')).toBe(normaliseGovernorate('القاهره'));
    // The leading محافظة carries no identity, the way "Governorate" does not.
    expect(normaliseGovernorate('محافظة القاهرة')).toBe(
      normaliseGovernorate('القاهرة'),
    );
    // أ إ آ ٱ all fold to ا.
    expect(normaliseGovernorate('الإسكندرية')).toBe(
      normaliseGovernorate('الاسكندرية'),
    );
  });

  it('reduces a slug and a phrase to the same thing', () => {
    expect(normaliseGovernorate('north-sinai')).toBe(
      normaliseGovernorate('North Sinai'),
    );
  });

  it('returns null for anything that identifies nowhere', () => {
    // The literal em dash manual orders write when an admin took only a phone
    // number. It must be a MISS, never a match — matching it would attach a
    // real governorate's fee to an address that names none.
    expect(normaliseGovernorate('—')).toBeNull();
    expect(normaliseGovernorate('')).toBeNull();
    expect(normaliseGovernorate('   ')).toBeNull();
    expect(normaliseGovernorate('...')).toBeNull();
    expect(normaliseGovernorate(null)).toBeNull();
    expect(normaliseGovernorate(42)).toBeNull();
  });
});

describe('resolveGovernorateRates — the guards, not the schema', () => {
  it('is empty for anything that is not an array', () => {
    expect(resolveGovernorateRates(undefined)).toEqual([]);
    expect(resolveGovernorateRates({ rates: null })).toEqual([]);
    expect(resolveGovernorateRates({ rates: { cairo: 6000 } })).toEqual([]);
  });

  it('DROPS a row whose fee survived storage as a string', () => {
    // #2's failure mode: it passes every schema check on the way in and is
    // still not chargeable. Dropping it means the address falls to the global
    // rate AND reports a miss, which someone can notice.
    const out = resolveGovernorateRates({
      rates: [{ key: 'giza', label: 'Giza', feeCents: '5000' }],
    });
    expect(out).toEqual([]);
  });

  it('drops a keyless row and de-duplicates on key, first wins', () => {
    const out = resolveGovernorateRates({
      rates: [
        { key: '  ', label: 'Nowhere', feeCents: 100 },
        { key: 'cairo', label: 'Cairo', feeCents: 6_000 },
        { key: 'cairo', label: 'Cairo again', feeCents: 9_900 },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].feeCents).toBe(6_000);
  });

  it('reads an absent `enabled` as enabled, and only `false` as disabled', () => {
    // A row written before the field existed meant "we deliver here".
    const [absent, explicit] = resolveGovernorateRates({
      rates: [
        { key: 'a', label: 'A', feeCents: 1 },
        { key: 'b', label: 'B', feeCents: 1, enabled: false },
      ],
    });
    expect(absent.enabled).toBe(true);
    expect(explicit.enabled).toBe(false);
  });

  it('falls back to the key as a label, and keeps only string aliases', () => {
    const [only] = resolveGovernorateRates({
      rates: [{ key: 'red-sea', feeCents: 12_000, aliases: ['Al Bahr al Ahmar', 7, ''] }],
    });
    expect(only.label).toBe('red-sea');
    expect(only.aliases).toEqual(['Al Bahr al Ahmar']);
  });
});

describe('resolveGovernorateRate — precedence and visibility', () => {
  const effective = effectiveWith({
    rates: [
      rate({ key: 'giza', label: 'Giza', feeCents: 7_000, aliases: ['Cairo'] }),
      rate({ key: 'cairo', label: 'Cairo', feeCents: 6_000 }),
    ],
  });

  it('sweeps KEY across the whole table before trying LABEL or ALIAS', () => {
    // Giza carries an alias of "Cairo" and sits FIRST. If the passes were
    // per-row instead of per-field, an alias would steal an address that names
    // Cairo's key outright — and the shopper would be quoted Giza's fee.
    const resolved = resolveGovernorateRate(effective, 'cairo');
    expect(resolved.key).toBe('cairo');
    expect(resolved.matchedOn).toBe('KEY');
    expect(resolved.baseFeeCents).toBe(6_000);
  });

  it('reports NO_RATES when the shop has no table — not a miss', () => {
    // The pre-#83 world exactly. This is the branch the live shop runs on.
    const resolved = resolveGovernorateRate(LIVE_TODAY, 'Cairo');
    expect(resolved.status).toBe('NO_RATES');
    expect(resolved.baseFeeCents).toBe(10_000);
  });

  it('reports NO_MATCH — visibly — for free text nothing matches', () => {
    // THE case the issue is about. The fee is the global rate either way; what
    // must not happen is that being indistinguishable from a real match.
    const resolved = resolveGovernorateRate(effective, 'Atlantis');
    expect(resolved.status).toBe('NO_MATCH');
    expect(resolved.key).toBeNull();
    expect(resolved.baseFeeCents).toBe(10_000);
    // The shopper's own words survive, unnormalised, so the UI can show them.
    expect(resolved.governorate).toBe('Atlantis');
  });

  it("reports NO_GOVERNORATE for a manual order's em dash", () => {
    const resolved = resolveGovernorateRate(effective, '—');
    expect(resolved.status).toBe('NO_GOVERNORATE');
    expect(resolved.baseFeeCents).toBe(10_000);
  });

  it('still MATCHES a disabled row and still charges its fee', () => {
    // DECISION 3: modelled, not enforced. A saved address naming a disabled
    // governorate is charged that row — so the storefront must show that fee,
    // not the global one, however it chooses to populate its select.
    const withDisabled = effectiveWith({
      rates: [rate({ key: 'sinai', label: 'Sinai', feeCents: 15_000, enabled: false })],
    });
    const resolved = resolveGovernorateRate(withDisabled, 'Sinai');
    expect(resolved.status).toBe('DISABLED');
    expect(resolved.baseFeeCents).toBe(15_000);
  });

  it('matches through an alias an admin added for a historical spelling', () => {
    const withAlias = effectiveWith({
      rates: [rate({ key: 'cairo', label: 'Cairo', aliases: ['القاهره'] })],
    });
    const resolved = resolveGovernorateRate(withAlias, 'محافظة القاهرة');
    expect(resolved.matchedOn).toBe('ALIAS');
    expect(resolved.key).toBe('cairo');
  });
});

describe('quoteShipping — DECISION 1, mirrored not invented', () => {
  const effective = effectiveWith({
    freeOverCents: 150_000,
    rates: [rate({ key: 'aswan', label: 'Aswan', feeCents: 12_000 })],
  });

  it('lets free shipping BEAT a matched governorate rate', () => {
    // The backend's default. A shop advertising free delivery over a threshold
    // has made a promise; charging EGP 120 anyway because someone lives in
    // Aswan is the failure that arrives as a surprise at the payment step.
    expect(FREE_SHIPPING_BEATS_GOVERNORATE_RATE).toBe(true);
    const quote = quoteShipping(effective, 150_000, 'Aswan');
    expect(quote.feeCents).toBe(0);
    expect(quote.freeShippingApplied).toBe(true);
    // The resolution is still reported — free shipping does not erase WHERE
    // the parcel is going.
    expect(quote.rate.key).toBe('aswan');
  });

  it('is free at exactly the threshold, not only above it', () => {
    expect(quoteShipping(effective, 149_999, 'Aswan').feeCents).toBe(12_000);
    expect(quoteShipping(effective, 150_000, 'Aswan').feeCents).toBe(0);
  });

  it('treats freeOverCents of 0 as "no threshold", never "always free"', () => {
    const noThreshold = effectiveWith({ freeOverCents: 0, rates: effective.rates });
    expect(quoteShipping(noThreshold, 0, 'Aswan').feeCents).toBe(12_000);
  });

  it('charges the global rate when no governorate is supplied at all', () => {
    // The bag, before an address exists. Pre-#83 behaviour, preserved.
    expect(quoteShipping(effective, 1_000).feeCents).toBe(10_000);
  });
});

describe('minFeeCentsFor and selectableRates — DECISION 2', () => {
  const rates = [
    rate({ key: 'cairo', feeCents: 6_000 }),
    rate({ key: 'sinai', feeCents: 3_000, enabled: false }),
  ];

  it('prefers the number the backend published over recomputing it', () => {
    expect(minFeeCentsFor(10_000, rates, 6_000)).toBe(6_000);
  });

  it('recomputes when the published value is missing or unusable', () => {
    // An older backend, or a field that arrived as a string. Falling back to
    // the DEFAULT here would have the bag quote "from EGP 100" while the
    // table's cheapest selectable row is EGP 60.
    expect(minFeeCentsFor(10_000, rates, undefined)).toBe(6_000);
    expect(minFeeCentsFor(10_000, rates, '6000')).toBe(6_000);
  });

  it('excludes DISABLED rows from both the floor and the select', () => {
    // A fee nobody can select is not a price anyone can be quoted. Sinai is
    // EGP 30 and disabled: it must not become the shop's "from" price, and it
    // must not appear as an option.
    expect(minFeeCentsFor(10_000, rates, undefined)).not.toBe(3_000);
    expect(selectableRates(effectiveWith({ rates })).map((r) => r.key)).toEqual([
      'cairo',
    ]);
  });

  it('is the global rate when there is no table', () => {
    expect(minFeeCentsFor(10_000, [], undefined)).toBe(10_000);
  });
});

describe('resolveEffectiveShipping — the wire, as it actually arrives', () => {
  it('reads the live payload verbatim', () => {
    // Copied from GET https://backend.minirueshop.com/v1/settings/public,
    // 2026-09-12. An empty `rates` is the whole back-compat guarantee.
    const effective = resolveEffectiveShipping({
      currency: 'EGP',
      shipping: {
        flatRateCents: 10_000,
        freeOverCents: 0,
        currency: 'EGP',
        freeShippingBasis: 'BEFORE_DISCOUNT',
        rates: [],
        minFeeCents: 10_000,
      },
    });
    expect(effective).toEqual({
      flatRateCents: 10_000,
      freeOverCents: 0,
      currency: 'EGP',
      freeShippingBasis: 'BEFORE_DISCOUNT',
      rates: [],
      minFeeCents: 10_000,
    });
  });

  it('falls back to the backend default for a shipping block that is not there', () => {
    const effective = resolveEffectiveShipping({ currency: 'EGP' });
    expect(effective.flatRateCents).toBe(5_000);
    expect(effective.rates).toEqual([]);
    expect(effective.minFeeCents).toBe(5_000);
  });

  it('takes the STORE currency, never the shipping block’s', () => {
    // Checkout builds every money value with the store currency and never
    // reads shipping.currency at all. Publishing the stored one would label
    // the delivery line in a currency no part of the server honours.
    const effective = resolveEffectiveShipping({
      currency: 'EGP',
      shipping: { flatRateCents: 1, currency: 'USD' },
    });
    expect(effective.currency).toBe('EGP');
  });
});

describe('shippingSummary — what each screen is allowed to promise', () => {
  const withTable = effectiveWith({
    minFeeCents: 6_000,
    rates: [
      rate({ key: 'cairo', label: 'Cairo', feeCents: 6_000 }),
      rate({ key: 'aswan', label: 'Aswan', feeCents: 12_000 }),
    ],
  });

  it('the BAG, with a table: a floor, flagged as one', () => {
    const s = shippingSummary({ effective: withTable, subtotalMinor: 45_000 });
    expect(s.fromOnly).toBe(true);
    expect(s.feeMinor).toBe(6_000); // minFeeCents, not the global rate
    expect(s.totalMinor).toBe(51_000);
    expect(s.resolved).toBeNull();
  });

  it('the BAG, with NO table: the firm figure it always was', () => {
    // The live shop. Nothing about this screen changes.
    const s = shippingSummary({ effective: LIVE_TODAY, subtotalMinor: 45_000 });
    expect(s.fromOnly).toBe(false);
    expect(s.feeMinor).toBe(10_000);
    expect(s.totalMinor).toBe(55_000);
  });

  it('the ADDRESS step: the chosen governorate, firm', () => {
    const s = shippingSummary({
      effective: withTable,
      subtotalMinor: 45_000,
      governorate: 'Aswan',
    });
    expect(s.fromOnly).toBe(false);
    expect(s.feeMinor).toBe(12_000);
    expect(s.resolved?.label).toBe('Aswan');
  });

  it('the bag’s floor is never above what the address step charges', () => {
    // The invariant that makes "from" honest. Stated over the whole table
    // rather than over one example, because the point is that no governorate
    // can undercut the number the bag already showed.
    const bag = shippingSummary({ effective: withTable, subtotalMinor: 45_000 });
    for (const r of withTable.rates) {
      const step = shippingSummary({
        effective: withTable,
        subtotalMinor: 45_000,
        governorate: r.label,
      });
      expect(step.totalMinor).toBeGreaterThanOrEqual(bag.totalMinor);
    }
    // And for free text that matches nothing, which pays the global rate.
    const unmatched = shippingSummary({
      effective: withTable,
      subtotalMinor: 45_000,
      governorate: 'Atlantis',
    });
    expect(unmatched.totalMinor).toBeGreaterThanOrEqual(bag.totalMinor);
  });

  it('says Free, exactly, once the threshold is met — no "from"', () => {
    // Free beats every governorate rate, so it is not an estimate and must not
    // be hedged. Hedging it would take back the promise the product page makes.
    const free = effectiveWith({ freeOverCents: 150_000, rates: withTable.rates });
    const s = shippingSummary({ effective: free, subtotalMinor: 150_000 });
    expect(s.free).toBe(true);
    expect(s.fromOnly).toBe(false);
    expect(s.totalMinor).toBe(150_000);
  });

  it('judges the threshold BEFORE the discount by default', () => {
    // A bag that earned free delivery does not lose it the moment a code is
    // applied — the backend's default `freeShippingBasis`.
    const free = effectiveWith({ freeOverCents: 150_000, rates: withTable.rates });
    const s = shippingSummary({
      effective: free,
      subtotalMinor: 150_000,
      discountMinor: 20_000,
      governorate: 'Aswan',
    });
    expect(s.free).toBe(true);
    expect(s.totalMinor).toBe(130_000);
  });

  it('judges it AFTER the discount when the shop says so', () => {
    const after = effectiveWith({
      freeOverCents: 150_000,
      freeShippingBasis: 'AFTER_DISCOUNT',
      rates: withTable.rates,
    });
    const s = shippingSummary({
      effective: after,
      subtotalMinor: 150_000,
      discountMinor: 20_000,
      governorate: 'Aswan',
    });
    expect(s.free).toBe(false);
    expect(s.feeMinor).toBe(12_000);
  });

  it('never floors the discount against the delivery fee', () => {
    // A discount larger than the goods must not also pay for the parcel.
    const s = shippingSummary({
      effective: LIVE_TODAY,
      subtotalMinor: 5_000,
      discountMinor: 90_000,
      governorate: 'Cairo',
    });
    expect(s.totalMinor).toBe(10_000);
  });
});
