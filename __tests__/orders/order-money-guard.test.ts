import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * #116 (and #1) — no order screen prints an amount the way the API sends it.
 *
 * Checkout step 4 rendered `{item.lineTotalAmount} {order.totalCurrency}`, so a
 * shopper who had just paid read `399.5000 EGP` — the exact defect #1 closed for
 * product cards. `/orders/[id]/confirmation` (removed in #121) had its own `toFixed(2)` helper and
 * printed `399.50` with no grouping. Every amount on these screens goes through
 * `formatMoney` (lib/format/money.ts) — directly, via `formatOrderTotal`, or
 * as the `amount` prop of `<PriceDisplay>`.
 *
 * Source-level on purpose: the failure is a pattern a reviewer misses in a
 * long JSX block, and a render test would only catch the one path it mounts.
 * If this fails, route the value through the formatter — do not reshape the
 * expression to slip past the regex.
 */

const SCREENS = [
  'app/checkout/confirmation/page.tsx',
  'app/checkout/instapay/page.tsx',
  'app/account/orders/OrderHistoryClient.tsx',
  'app/account/orders/[id]/OrderDetailClient.tsx',
  'app/account/orders/[id]/refund/RefundRequestClient.tsx',
  'app/account/refunds/RefundsPageClient.tsx',
  'components/orders/OrderLineList.tsx',
];

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');

/**
 * `{x.lineTotalAmount}` as a JSX CHILD. A prop (`amount={x.totalAmount}`) is
 * preceded by `=` and is how PriceDisplay receives its value, so it is allowed.
 */
const RAW_AMOUNT_CHILD = /(?<![=\w])\{\s*[\w.?!]*Amount\s*\}/;

describe('order screens never render a raw amount', () => {
  it.each(SCREENS)('%s has no raw `{…Amount}` child', (file) => {
    const offending = read(file)
      .split('\n')
      .map((text, i) => ({ line: i + 1, text: text.trim() }))
      .filter(({ text }) => RAW_AMOUNT_CHILD.test(text));
    expect(offending).toEqual([]);
  });

  it.each(SCREENS)('%s has no private toFixed price helper', (file) => {
    // `toFixed(2)` is what writes `799.00`; the one allowed use turns integer
    // cents into the decimal string formatOrderTotal expects.
    const offending = read(file)
      .split('\n')
      .filter((text) => /toFixed\(/.test(text) && !/Cents \/ 100\)\.toFixed\(2\)/.test(text));
    expect(offending).toEqual([]);
  });

  it('the guard itself catches the reported line', () => {
    // A control: if the regex ever stops matching the original defect, every
    // green above means nothing.
    expect(RAW_AMOUNT_CHILD.test('{item.lineTotalAmount} {order.totalCurrency}')).toBe(true);
    expect(RAW_AMOUNT_CHILD.test('Total paid {order.totalAmount}')).toBe(true);
    expect(RAW_AMOUNT_CHILD.test('<PriceDisplay amount={order.totalAmount} />')).toBe(false);
  });
});

/**
 * #141 — sets had their own copy of the same defect: a private
 * `minorToAmount(minor) => (minor / 100).toFixed(2)` helper, printing
 * `"774.00 EGP"` where every other screen prints `"EGP 774"` via `formatMoney`
 * (lib/format/money.ts). Same class of bug as #1/#116, now on the bundle
 * screens rather than the order screens.
 *
 * `minorToAmount`/`.toFixed(2)` output is always concatenated with a currency
 * code as a JSX sibling text node (`{minorToAmount(x)} {bundle.currency}`),
 * not a single `{…Amount}` interpolation, so the RAW_AMOUNT_CHILD regex above
 * does not catch it — this needs its own guard.
 */
const BUNDLE_SCREENS = [
  'app/bundles/page.tsx',
  'app/bundles/[slug]/BundleDetail.tsx',
  'components/storefront/BundleCrossSell.tsx',
];

describe('bundle screens never render a raw amount', () => {
  it.each(BUNDLE_SCREENS)('%s has no private minorToAmount/toFixed price helper', (file) => {
    const offending = read(file)
      .split('\n')
      .map((text, i) => ({ line: i + 1, text: text.trim() }))
      .filter(({ text }) => /toFixed\(/.test(text) || /function minorToAmount/.test(text));
    expect(offending).toEqual([]);
  });

  it.each(BUNDLE_SCREENS)('%s uses formatMoney for prices, not string-concatenated minor amounts', (file) => {
    expect(read(file)).toMatch(/formatMoney\(/);
  });
});
