/**
 * How a price is written, once, for the whole storefront.
 *
 * There were four spellings of this in the codebase and a shopper could meet
 * three of them in one session: `EGP 799.0000` on the home page (a raw
 * `NUMERIC(*,4)` string interpolated straight into the DOM), `EGP 799` on
 * /shop/all, `EGP 450.00` in order history. A price that formats one way on the
 * card and another at checkout reads as a different price.
 *
 * The rule (#1):
 *
 *   - no decimal part on a whole amount — `EGP 799`, never `EGP 799.00`
 *   - decimals kept when they are real — `EGP 799.50` stays as it is
 *   - a thousands separator, always — `EGP 1,299` must not be mistakable for
 *     `EGP 129`; a shopper should never have to count digits
 *
 * Not `toFixed()`: `toFixed(2)` is what produces the trailing `.00`, and it
 * does no grouping at all.
 *
 * One correction to the issue's implementation note, which suggested a single
 * `{ minimumFractionDigits: 0, maximumFractionDigits: 2 }`. That drops a
 * trailing zero inside the decimals too — 799.50 comes out as `EGP 799.5`,
 * which is not a price anyone writes. Whole and fractional are therefore two
 * different formats, chosen after rounding to the piastre:
 *
 *   799.0000 -> EGP 799        (no fraction digits at all)
 *   799.5000 -> EGP 799.50     (exactly two)
 *   1299     -> EGP 1,299
 *
 * The locale is pinned rather than the visitor's, so the separator does not
 * change between two prices on the same page depending on where the reader is.
 */
const LOCALE = 'en-EG';

const WHOLE = { minimumFractionDigits: 0, maximumFractionDigits: 0 } as const;
const FRACTIONAL = { minimumFractionDigits: 2, maximumFractionDigits: 2 } as const;

/** Whole to the piastre — `799.0000` is, `799.5000` is not. */
function fractionRule(num: number) {
  return Math.round(num * 100) % 100 === 0 ? WHOLE : FRACTIONAL;
}

/**
 * @param amount a decimal string as the API sends it (`"799.0000"`), or a number
 * @param currency ISO 4217 code, e.g. `EGP`
 */
export function formatMoney(amount: string | number, currency: string): string {
  const num = typeof amount === 'number' ? amount : parseFloat(amount);
  // Unparseable input is shown as it came rather than as "NaN" or "0" — a
  // wrong price is worse than an obviously broken one.
  if (!Number.isFinite(num)) return `${currency} ${amount}`;
  const rule = fractionRule(num);
  try {
    return new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency,
      ...rule,
    }).format(num);
  } catch {
    // Intl throws on a currency code it does not recognise. Same rule by hand.
    return `${currency} ${num.toLocaleString(LOCALE, rule)}`;
  }
}
