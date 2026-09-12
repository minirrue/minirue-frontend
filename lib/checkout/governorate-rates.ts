/**
 * Per-governorate delivery rates, as the storefront has to read them (#83).
 *
 * ## What this file is, said plainly
 *
 * It is a **hand-kept mirror of the backend's `src/settings/shipping-policy.ts`**
 * — `normaliseGovernorate`, `resolveGovernorateRates`, `resolveGovernorateRate`
 * and `quoteShipping`, copied rule for rule. That is not an accident and it is
 * not something to be pleased about. `lib/api/settings.ts` already carried a
 * hand-copy of `shippingMinorFor` (#38), and #83 says out loud that "two
 * hand-kept copies of that would drift, and the drift is 'the cart says 50 and
 * the invoice says 120'".
 *
 * This module is the frontend's half of that duplication, gathered into ONE
 * file rather than scattered across the three screens that need it, so that
 * when `POST /v1/checkout/quote` lands the deletion is a single file and its
 * callers — not an archaeology exercise. The PR that adds it states the exact
 * size of the mirror; keep that statement true.
 *
 * ## Why it exists at all
 *
 * The shopper picks a governorate at the address step and the summary beside
 * it has to change. There is no endpoint that will price a cart for an address
 * (`GET /v1/cart` returns a subtotal and nothing else), so the number on screen
 * has to be computed here. The only way that number is not a *different* wrong
 * number from the one checkout charges is to copy checkout's rules exactly —
 * including the parts that look like paranoia:
 *
 *   - `typeof === 'number'` guards, not truthiness, because a `feeCents` that
 *     survived storage as the STRING "5000" passes the write schema and is
 *     still dropped at checkout.
 *   - a dropped row means the address falls to the global rate AND the
 *     resolution reports a miss. Both halves, or the under-charge is silent.
 *   - `freeOverCents: 0` means "no threshold", never "everything ships free".
 *
 * ## What it must not do
 *
 * Import anything. Not for the #7 reason — this module is not
 * `checkout-money.ts` and is not on the root layout's critical path by
 * necessity — but because `lib/api/settings.ts` IS reached from
 * `app/layout.tsx`, and settings.ts imports this. Pure string work with no
 * dependencies costs every page a few hundred bytes of tree-shakeable code;
 * a library here would cost every page the library.
 */

/**
 * DECISION 1 of #83, mirrored from the backend's constant of the same name.
 *
 * `true` — a free-delivery threshold BEATS a per-governorate rate.
 *
 * This is NOT a second rule invented for the storefront. If the backend's
 * constant is flipped, flip this one, and `quoteShipping` below reverses with
 * it in exactly the same way. The failure this prevents is the cart saying
 * "Free" while the invoice says EGP 120, which is worse than either answer.
 */
export const FREE_SHIPPING_BEATS_GOVERNORATE_RATE: boolean = true;

/** Mirrors `DEFAULT_SHIPPING_AMOUNT_MINOR` — EGP 50.00. */
export const DEFAULT_SHIPPING_AMOUNT_MINOR = 5_000;

/** Which figure the free-delivery threshold is judged on. */
export type FreeShippingBasis = 'BEFORE_DISCOUNT' | 'AFTER_DISCOUNT';

/**
 * One row of the admin's table, as published on `GET /v1/settings/public`.
 *
 * `key` is machine-facing and is what an order records. `label` is what the
 * shopper sees in the select — and is what the select SENDS, because the
 * address snapshot ends up printed on a parcel and a slug is not an address.
 * The backend's matcher sweeps KEY across the whole table before LABEL, so a
 * label can never be stolen by another row's alias.
 */
export interface GovernorateRate {
  key: string;
  label: string;
  feeCents: number;
  /**
   * DECISION 3 of #83: modelled, not enforced. A `false` row still MATCHES and
   * is still charged its fee server-side — nothing blocks checkout on it.
   *
   * The storefront's one use of it: a disabled rate is not offered in the
   * select, because `minFeeCents` excludes disabled rows and "from EGP X" must
   * not quote a price nobody can choose. An address already SAVED with a
   * disabled governorate still resolves to it and still shows its real fee.
   */
  enabled: boolean;
  aliases: string[];
}

/** The resolved policy — every fallback already applied. */
export interface EffectiveShipping {
  flatRateCents: number;
  /** `0` means there is no free-shipping threshold. */
  freeOverCents: number;
  currency: string;
  freeShippingBasis: FreeShippingBasis;
  rates: GovernorateRate[];
  /**
   * The cheapest delivery anyone in this shop can be charged: `min` of the
   * global rate and every ENABLED rate's fee.
   *
   * DECISION 2 of #83. Published so the bag can say "from EGP X" before an
   * address exists without every client folding over `rates` itself and
   * disagreeing about whether disabled rows count. They do not.
   *
   * Recomputed here rather than trusted from the wire only when the published
   * value is missing or unusable — see `resolveEffectiveShipping`.
   */
  minFeeCents: number;
}

/** What the whole shop looks like when settings cannot be read. */
export const DEFAULT_EFFECTIVE_SHIPPING: EffectiveShipping = {
  flatRateCents: DEFAULT_SHIPPING_AMOUNT_MINOR,
  freeOverCents: 0,
  currency: 'EGP',
  freeShippingBasis: 'BEFORE_DISCOUNT',
  rates: [],
  minFeeCents: DEFAULT_SHIPPING_AMOUNT_MINOR,
};

// ─────────────────────────────────────────────────────────────────────────────
// Normalisation — the free-text problem
// ─────────────────────────────────────────────────────────────────────────────
//
// `governorate` has been FREE TEXT on every address since the schema was
// written. Live rows hold "Cairo", "cairo", "القاهرة", "Cairo Governorate" and
// the literal '—' that manual orders write. A `rates[address.governorate]`
// lookup matches the first and silently bills the global rate for the rest.

/**
 * Tatweel and the Arabic harakat. Decorative; never identity.
 *
 * Spelled as explicit code points rather than as the literal combining marks
 * the backend uses: they are invisible in a diff, and a reviewer cannot tell a
 * correct range from a mangled one. U+0640 is the tatweel, U+064B-U+065F the
 * harakat, U+0670 the superscript alef.
 */
const ARABIC_MARKS = /[\u0640\u064B-\u065F\u0670]/g;

/**
 * Everything that is neither a letter, a digit, nor a space.
 *
 * Built with `new RegExp` rather than written as a literal because `tsconfig`
 * targets ES2017 and `\p{…}` escapes are an ES2018 feature — TypeScript
 * rejects the literal form against that target. The pattern is identical to
 * the backend's `/[^\p{L}\p{N} ]+/gu`; every runtime this ships to supports it.
 */
const NOT_IDENTITY = new RegExp('[^\\p{L}\\p{N} ]+', 'gu');

/** "Cairo Governorate", "Cairo gov." — the suffix carries no identity. */
const EN_SUFFIX = /\s+(governorate|governate|gov)$/;

/** The Arabic equivalent, which leads rather than trails. */
const AR_PREFIX = /^(محافظة|محافظه)\s+/;

/**
 * The free text reduced to something two spellings of one place share.
 *
 * Returns `null` for anything that identifies nowhere: a non-string, an empty
 * string, and placeholder punctuation — notably the '—' a manual order writes
 * when an admin took only a phone number. `null` is a MISS, never a match.
 *
 * Applied to the stored `key`, `label` and `aliases` as well, so the
 * comparison is symmetric: an admin who typed the label "Cairo Governorate"
 * still matches an address that says "cairo".
 *
 * This will never be exhaustive and is not trying to be — `aliases` is the
 * part that is. What it must do is never match the WRONG governorate, which is
 * why every rule below only removes decoration.
 */
export function normaliseGovernorate(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  let s = value.normalize('NFKC').replace(ARABIC_MARKS, '').toLowerCase();

  // Arabic orthography Egyptian shoppers type interchangeably. Folding these is
  // the difference between "القاهرة" and "القاهره" being one place and being
  // two, only one of which has a rate.
  s = s
    .replace(/[أإآٱ]/g, 'ا') // أ إ آ ٱ → ا
    .replace(/ى/g, 'ي') // ى → ي
    .replace(/ة/g, 'ه'); // ة → ه

  // Punctuation to space BEFORE the affix rules, so "Cairo Governorate." and
  // the slug "north-sinai" both reach them in a comparable shape.
  s = s.replace(NOT_IDENTITY, ' ').replace(/ +/g, ' ').trim();

  s = s.replace(AR_PREFIX, '').replace(EN_SUFFIX, '').trim();

  return s.length > 0 ? s : null;
}

/**
 * The rate table as it is SAFE to read, not as the write schema promised.
 *
 * A row whose `feeCents` survived storage as the string "5000" is DROPPED — it
 * cannot be charged, and pretending it matched would show a number nobody
 * chose. Dropping it means the address falls to the global rate AND the
 * resolution reports a miss, which is an outcome someone can notice.
 */
export function resolveGovernorateRates(shipping: unknown): GovernorateRate[] {
  const raw = (shipping as { rates?: unknown } | null | undefined)?.rates;
  if (!Array.isArray(raw)) return [];

  const out: GovernorateRate[] = [];
  const seen = new Set<string>();

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const r = entry as Record<string, unknown>;

    if (typeof r.key !== 'string' || r.key.trim().length === 0) continue;
    if (
      typeof r.feeCents !== 'number' ||
      !Number.isFinite(r.feeCents) ||
      r.feeCents < 0
    ) {
      continue;
    }

    const key = r.key.trim();
    // First wins. Duplicate keys are rejected on write; if one reaches storage
    // anyway, a deterministic winner beats an ambiguous lookup.
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      key,
      label:
        typeof r.label === 'string' && r.label.trim().length > 0
          ? r.label.trim()
          : key,
      feeCents: Math.round(r.feeCents),
      // Absent reads as enabled: a row written before the field existed meant
      // "we deliver here". Only an explicit `false` disables.
      enabled: r.enabled !== false,
      aliases: Array.isArray(r.aliases)
        ? r.aliases
            .filter(
              (a): a is string => typeof a === 'string' && a.trim().length > 0,
            )
            .map((a) => a.trim())
        : [],
    });
  }

  return out;
}

/** Why a governorate did, or did not, get its own fee. */
export type GovernorateMatchStatus =
  /** No table configured — the pre-#83 world, exactly. Not a miss. */
  | 'NO_RATES'
  /** Matched an enabled rate; its fee applies. */
  | 'MATCHED'
  /**
   * Matched a rate flagged `enabled: false`. The global flat rate is charged,
   * NOT this row's fee.
   *
   * It used to be charged anyway, and that was wrong in a way that only shows
   * up as money: a disabled row is deliberately excluded from `minFeeCents`
   * (the "from EGP X" the bag advertises), so billing it bills a number the
   * admin switched off AND one the shopper was never quoted. Aswan disabled at
   * EGP 10 against a EGP 100 global rate advertised "from EGP 100" and charged
   * 10. minirue-backend#94 settled it: `enabled: false` means this row's fee is
   * not charged.
   *
   * Still not enforcement. The row still MATCHES and is still reported, so a
   * disabled governorate is visible rather than silently indistinguishable from
   * one that was never configured — nothing refuses the order.
   */
  | 'DISABLED'
  /** A table exists but the address carried nothing usable. Billed the global rate. VISIBLE. */
  | 'NO_GOVERNORATE'
  /**
   * A table exists, the address named a real place, and nothing matched it.
   * Billed the global rate. VISIBLE — this is the silent under-charge #83 is
   * about, and the storefront's job is to SAY so rather than draw a number.
   */
  | 'NO_MATCH';

export type GovernorateMatchedOn = 'KEY' | 'LABEL' | 'ALIAS';

export interface ResolvedGovernorateRate {
  status: GovernorateMatchStatus;
  key: string | null;
  label: string | null;
  matchedOn: GovernorateMatchedOn | null;
  /** The free text EXACTLY as supplied, never normalised. */
  governorate: string | null;
  /** The fee this resolution selects, BEFORE any free-shipping threshold. */
  baseFeeCents: number;
}

/**
 * Which rate a free-text governorate gets, and — when none — why not.
 *
 * Precedence is KEY, then LABEL, then ALIAS, each swept across the WHOLE table
 * before the next is tried. So an alias someone added to Giza can never steal
 * an address that names Cairo's key outright.
 */
export function resolveGovernorateRate(
  effective: Pick<EffectiveShipping, 'rates' | 'flatRateCents'>,
  governorate: unknown,
): ResolvedGovernorateRate {
  const verbatim = typeof governorate === 'string' ? governorate : null;
  const miss = (status: GovernorateMatchStatus): ResolvedGovernorateRate => ({
    status,
    key: null,
    label: null,
    matchedOn: null,
    governorate: verbatim,
    baseFeeCents: effective.flatRateCents,
  });

  if (effective.rates.length === 0) return miss('NO_RATES');

  const needle = normaliseGovernorate(governorate);
  if (needle === null) return miss('NO_GOVERNORATE');

  const passes: Array<
    [GovernorateMatchedOn, (r: GovernorateRate) => string[]]
  > = [
    ['KEY', (r) => [r.key]],
    ['LABEL', (r) => [r.label]],
    ['ALIAS', (r) => r.aliases],
  ];

  for (const [matchedOn, fieldsOf] of passes) {
    for (const rate of effective.rates) {
      const hit = fieldsOf(rate).some(
        (field) => normaliseGovernorate(field) === needle,
      );
      if (!hit) continue;
      /*
       * A disabled row still MATCHES — the shopper's governorate is known and
       * worth reporting — but it does not price. Its fee falls back to the
       * global flat rate, mirroring `shipping-policy.ts` on the server.
       *
       * The two must agree exactly. This file is a hand-copy of that module,
       * so a change on one side that does not land on the other shows up as the
       * cart quoting one number and the invoice charging another — which is the
       * whole of minirue-backend#79, rebuilt.
       */
      const enabled = rate.enabled;
      return {
        status: enabled ? 'MATCHED' : 'DISABLED',
        key: rate.key,
        label: rate.label,
        matchedOn,
        governorate: verbatim,
        baseFeeCents: enabled ? rate.feeCents : effective.flatRateCents,
      };
    }
  }

  return miss('NO_MATCH');
}

/** What a cart is charged, and everything a caller needs to explain it. */
export interface ShippingQuote {
  /** Minor units. The number actually billed. */
  feeCents: number;
  /** True when `freeOverCents` took the fee to zero. */
  freeShippingApplied: boolean;
  rate: ResolvedGovernorateRate;
}

/**
 * The whole delivery decision in one call: resolve the governorate, then apply
 * the free-delivery threshold over the top of it.
 *
 * `subtotalMinor` is whichever figure `freeShippingBasis` selects — the bag
 * before the discount by default. Callers pick which figure to hand in; see
 * `subtotalForBasis` below so nobody has to remember the convention twice.
 *
 * Omit `governorate` — the bag, before an address exists — and the quote is
 * the global rate with a status saying why; pair that with `minFeeCents` to
 * say "from EGP X" instead of promising a total that can only go up.
 */
export function quoteShipping(
  effective: EffectiveShipping,
  subtotalMinor: number,
  governorate?: unknown,
): ShippingQuote {
  const rate = resolveGovernorateRate(effective, governorate);

  // 0 disables the threshold; without this check every order would ship free.
  const thresholdMet =
    effective.freeOverCents > 0 && subtotalMinor >= effective.freeOverCents;

  if (thresholdMet) {
    // DECISION 1. Flipping FREE_SHIPPING_BEATS_GOVERNORATE_RATE is the entire
    // reversal, on this side exactly as on the backend's.
    /*
     * MATCHED only. A DISABLED row is charging the GLOBAL rate now, not its
     * own, so there is no governorate fee left for it to out-rank — including
     * it here would let a switched-off row override free shipping using a fee
     * that is not being applied.
     */
    const governorateRateWins =
      !FREE_SHIPPING_BEATS_GOVERNORATE_RATE && rate.status === 'MATCHED';

    if (!governorateRateWins) {
      return { feeCents: 0, freeShippingApplied: true, rate };
    }
  }

  return { feeCents: rate.baseFeeCents, freeShippingApplied: false, rate };
}

/**
 * The figure the free-delivery threshold is judged on, per the shop's basis.
 *
 * Stated once here because getting it wrong is invisible until a shopper
 * applies a code and watches the delivery fee reappear.
 */
export function subtotalForBasis(
  effective: EffectiveShipping,
  subtotalMinor: number,
  discountMinor: number,
): number {
  return effective.freeShippingBasis === 'AFTER_DISCOUNT'
    ? Math.max(0, subtotalMinor - discountMinor)
    : subtotalMinor;
}

/**
 * The cheapest delivery this shop can charge anybody.
 *
 * The backend publishes `minFeeCents` and that value is preferred — one
 * definition, and it already knows things a client does not. This recomputes
 * it only when the published number is absent or unusable (an older backend, a
 * field that arrived as a string), because the alternative is the bag quoting
 * "from EGP 50" out of the default while the table's cheapest row is EGP 35.
 */
export function minFeeCentsFor(
  flatRateCents: number,
  rates: GovernorateRate[],
  published?: unknown,
): number {
  if (typeof published === 'number' && Number.isFinite(published) && published >= 0) {
    return Math.round(published);
  }
  return rates
    .filter((r) => r.enabled)
    .reduce((min, r) => Math.min(min, r.feeCents), flatRateCents);
}

/**
 * What a shopper can actually choose at the address step.
 *
 * Disabled rows are excluded for the reason `minFeeCents` excludes them: a fee
 * nobody can select is not a price anyone can be quoted, and offering one in a
 * select would make the bag's "from EGP X" a lie in the other direction.
 */
export function selectableRates(effective: EffectiveShipping): GovernorateRate[] {
  return effective.rates.filter((r) => r.enabled);
}
