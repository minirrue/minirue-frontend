'use client';

/**
 * The two numbers the bag cannot work out for itself.
 *
 * The cart used to compute its whole summary from local rules: a hardcoded
 * shipping constant (#38), and no discount at all unless the shopper typed a
 * code (#36). Both of those are the server's to decide, and both were being
 * decided here — which is how the product page could say EGP 719.10 and the
 * bag say EGP 799 with nothing on screen to explain the difference.
 *
 * There is no totals endpoint to defer to — `GET /v1/cart` returns a subtotal
 * and nothing else, and there is no `/checkout/quote` — so the cart still does
 * the final addition. What changed is where the INPUTS come from.
 */

import React from 'react';
import {
  previewDiscount,
  type DiscountPreview,
  type DiscountPreviewLine,
} from '@/lib/api/discounts';
import { loadShippingPolicy } from '@/lib/api/settings';
import {
  DEFAULT_SHIPPING_POLICY,
  type ShippingPolicy,
} from '@/lib/checkout/checkout-money';

/**
 * One request per page load, not one per component.
 *
 * The policy is a single small fact that changes when an admin edits it, which
 * is approximately never within one visit. Hoisting the promise to the module
 * means the cart drawer and the cart page share the one read.
 */
let shippingPolicyPromise: Promise<ShippingPolicy> | null = null;

/** Test seam: drops the memoised read so each case starts clean. */
export function resetBagPricingCaches(): void {
  shippingPolicyPromise = null;
  automaticPreviewCache.clear();
}

/**
 * The shop's delivery rate, defaulting to the backend's own fallback until it
 * arrives.
 *
 * Starting at the default rather than at "unknown" is deliberate: a summary
 * that renders a blank where the shipping fee goes, then fills it in, is a
 * number changing under the shopper's eyes on the screen where they are
 * deciding whether to buy. The default is what the backend would charge if its
 * settings read failed, so the pessimistic first paint is never lower than the
 * truth.
 */
export function useShippingPolicy(): ShippingPolicy {
  const [policy, setPolicy] = React.useState<ShippingPolicy>(
    DEFAULT_SHIPPING_POLICY,
  );

  React.useEffect(() => {
    let cancelled = false;
    shippingPolicyPromise ??= loadShippingPolicy();
    void shippingPolicyPromise.then((next) => {
      if (!cancelled) setPolicy(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return policy;
}

/**
 * `POST /v1/discounts/preview` is throttled to 10 requests per 10 minutes per
 * IP, and `DiscountCodeField` spends from the same allowance every time the bag
 * changes while a code is applied. So this caches by bag shape for the life of
 * the page: changing a quantity from 1 to 2 and back asks the server once, not
 * three times.
 */
const automaticPreviewCache = new Map<string, DiscountPreview>();

/**
 * Long enough that holding the + button is one request rather than six.
 *
 * Every tap on the quantity stepper is a new bag, and at 10 requests per 10
 * minutes a shopper adjusting quantities would burn the allowance in seconds
 * and then be told nothing about their discount for the rest of the visit.
 */
const PREVIEW_DEBOUNCE_MS = 700;

export function bagKeyOf(lines: DiscountPreviewLine[]): string {
  return lines
    .map((l) => `${l.variantId}:${l.qty}:${l.unitPriceMinor}`)
    .sort()
    .join('|');
}

/**
 * What the sitewide markdown takes off this bag, as the server computes it.
 *
 * The endpoint accepts `code: null` and still runs the full `priceBag()` — the
 * same function checkout runs at Place order — folding in whatever automatic
 * offer is live. So this is not a second implementation of the discount rules
 * in the browser; it is the shop's own answer, asked for the bag on screen.
 *
 * Why not derive it from `GET /v1/discounts/sitewide` and the percentage the
 * product cards use? Because that endpoint returns a percentage or null, and
 * returns null for a FIXED-amount campaign — so a EGP 100-off markdown would
 * silently show as no discount. And eligibility is per line (a partner's
 * product is never cut, a set is never cut on top of its own saving), which the
 * cart cannot see: `CartItemDto` carries no ownership flag. Guessing either one
 * is how #3 happened.
 *
 * `enabled` is false while a typed code owns the summary. A coded preview
 * already returns `max(code, automatic)` with a `winner`, so running both would
 * spend two requests to learn one number — and risk showing their sum.
 */
export function useAutomaticDiscount(
  lines: DiscountPreviewLine[],
  enabled: boolean,
): DiscountPreview | null {
  const key = React.useMemo(() => bagKeyOf(lines), [lines]);
  const active = enabled && key !== '';

  /**
   * The answer is stored WITH the bag it answers.
   *
   * Keying it means a stale figure cannot outlive the bag it was computed for:
   * change a quantity and the discount row goes quiet until the server has
   * spoken about the new bag, rather than showing yesterday's saving against
   * today's contents — which is the same failure as #36, just one step
   * downstream.
   */
  const [fetched, setFetched] = React.useState<{
    key: string;
    preview: DiscountPreview;
  } | null>(null);

  // Read after commit, never during render — the same reason
  // `DiscountCodeField` does it: a discarded render must not leave this holding
  // a bag the shopper never saw.
  const linesRef = React.useRef(lines);
  React.useEffect(() => {
    linesRef.current = lines;
  });

  React.useEffect(() => {
    if (!active || automaticPreviewCache.has(key)) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const result = await previewDiscount(linesRef.current, null);
          automaticPreviewCache.set(key, result);
          if (!cancelled) setFetched({ key, preview: result });
        } catch {
          // Throttled, offline, or an older backend. The summary falls back to
          // no discount row, which is exactly what it showed before this
          // existed — and the server still applies the markdown at Place
          // order, so the shopper is charged correctly either way.
        }
      })();
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, active]);

  if (!active) return null;
  return automaticPreviewCache.get(key) ?? (fetched?.key === key ? fetched.preview : null);
}
