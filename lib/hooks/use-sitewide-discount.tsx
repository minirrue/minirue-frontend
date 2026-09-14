'use client';

import React from 'react';
import { apiFetch } from '@/lib/api/client';

/**
 * The sitewide markdown, fetched once for the whole app.
 *
 * Every product card needs the same single number, so this is a provider rather
 * than a hook each card calls — thirty cards on a listing page would otherwise
 * be thirty identical requests, and the one that matters most (the price a
 * shopper reads) would be the slowest thing on the page.
 *
 * `percent: null` means nothing is running, which is the normal state. In that
 * case every price renders exactly as it did before this existed — there is no
 * "discount mode" for the layout to get wrong.
 *
 * A failed first fetch is also `null`. Showing the real price when a markdown IS
 * running is a shopper paying less than the card said, which is a good surprise;
 * the reverse — striking a price when nothing is running — would be a lie.
 *
 * `cappedOffers` (Accounting epic, backend#155): checkout never lets a discount
 * take a product below its floor. For the variants where the running markdown
 * would, the server sends the price checkout will actually charge, in minor
 * units, keyed by variant id. Only those variants are listed; an older API that
 * sends no map leaves every price exactly as the plain percentage computes it.
 *
 * Prices can change while a tab stays open (the admin's strategy slider
 * reprices live), so the offer is re-read when the window regains focus — at
 * most once every 30 seconds.
 */

export interface SitewideOffer {
  percent: number | null;
  /** Minor units the server will charge, only for variants the floor caps. */
  cappedOffers: Readonly<Record<string, number>>;
}

const NO_OFFER: SitewideOffer = { percent: null, cappedOffers: {} };
const REFETCH_MIN_MS = 30_000;

const SitewideDiscountContext = React.createContext<SitewideOffer>(NO_OFFER);

/** Keeps only well-formed entries: a malformed cap must never lower a price. */
function readCappedOffers(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [variantId, minor] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof minor === 'number' && Number.isInteger(minor) && minor > 0) {
      out[variantId] = minor;
    }
  }
  return out;
}

export function SitewideDiscountProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [offer, setOffer] = React.useState<SitewideOffer>(NO_OFFER);

  React.useEffect(() => {
    let cancelled = false;
    let lastFetchAt = 0;

    const load = async () => {
      lastFetchAt = Date.now();
      try {
        const res = await apiFetch<{
          percent: number | null;
          cappedOffers?: unknown;
        }>('/discounts/sitewide');
        if (!cancelled) {
          setOffer({
            percent: res.percent ?? null,
            cappedOffers: readCappedOffers(res.cappedOffers),
          });
        }
      } catch {
        // First load: nothing struck through (see the note above). A failed
        // re-read keeps the last answer rather than flickering every price.
      }
    };

    void load();

    const onFocus = () => {
      if (Date.now() - lastFetchAt >= REFETCH_MIN_MS) void load();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return (
    <SitewideDiscountContext.Provider value={offer}>
      {children}
    </SitewideDiscountContext.Provider>
  );
}

/** The live percentage off, or null when no markdown is running. */
export function useSitewideDiscount(): number | null {
  return React.useContext(SitewideDiscountContext).percent;
}

/** The whole running offer, for callers that compare several variants. */
export function useSitewideOffer(): SitewideOffer {
  return React.useContext(SitewideDiscountContext);
}

/**
 * What a price in minor units becomes under the running offer.
 *
 * Rounds the SAVING up, matching the server's rule exactly. If these two
 * disagreed by a piastre the shop would advertise one number and charge
 * another, and the shopper would be right to distrust both.
 *
 * A capped variant is charged the server's figure: never less than that, and
 * never more than its own price.
 */
export function offerPriceMinor(
  minor: number,
  percent: number | null,
  cappedMinor?: number,
): number {
  if (percent === null) return minor;
  const savingMinor = Math.ceil((minor * Math.round(percent * 100)) / 10000);
  const byPercent = Math.max(0, minor - savingMinor);
  if (cappedMinor === undefined) return byPercent;
  return Math.min(minor, Math.max(byPercent, cappedMinor));
}

/**
 * What a price becomes under the running markdown, and what it was.
 *
 * Returns `wasAmount: undefined` when nothing applies, which is precisely what
 * `PriceDisplay` already expects for an ordinary price — so a card can call this
 * unconditionally and pass the result straight through.
 */
export function useDiscountedPrice(
  amount: string,
  /**
   * Required, and with no default.
   *
   * This used to default to `true`, so any caller that forgot the argument
   * discounted unconditionally — and a discount shown but not honoured is worse
   * than one missed. The safe answer to "I don't know" is "not eligible", and
   * making it required means a caller cannot quietly pick the unsafe one.
   *
   * Pass the server's `product.isMinirueOwned`, never a locally-derived guess:
   * ownership is the product AND its brand, and only the API sees both.
   */
  isMinirueOwned: boolean,
  /**
   * The variant this price belongs to, so a floor cap on it is honoured. Omit
   * only where no single variant is meant; the plain percentage then applies.
   */
  variantId?: string,
): { amount: string; wasAmount?: string } {
  const { percent, cappedOffers } = useSitewideOffer();

  // A partner's price is never cut by MiniRue's campaign — the same rule the
  // server enforces. A card that struck through a collab price would promise a
  // discount that checkout then refuses.
  if (percent === null || !isMinirueOwned) return { amount };

  const minor = Math.round(parseFloat(amount) * 100);
  if (!Number.isFinite(minor) || minor <= 0) return { amount };

  const capped = variantId === undefined ? undefined : cappedOffers[variantId];
  const nextMinor = offerPriceMinor(minor, percent, capped);

  // Capped all the way back to its own price: there is no saving to strike.
  if (nextMinor >= minor) return { amount };

  return {
    amount: (nextMinor / 100).toFixed(2),
    wasAmount: amount,
  };
}
