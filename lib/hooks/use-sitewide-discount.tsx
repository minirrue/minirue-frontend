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
 * `null` means nothing is running, which is the normal state. In that case every
 * price renders exactly as it did before this existed — there is no "discount
 * mode" for the layout to get wrong.
 *
 * A failed fetch is also `null`. Showing the real price when a markdown IS
 * running is a shopper paying less than the card said, which is a good surprise;
 * the reverse — striking a price when nothing is running — would be a lie.
 */

const SitewideDiscountContext = React.createContext<number | null>(null);

export function SitewideDiscountProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [percent, setPercent] = React.useState<number | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch<{ percent: number | null }>(
          '/discounts/sitewide',
        );
        if (!cancelled) setPercent(res.percent ?? null);
      } catch {
        // Nothing struck through this session. See the note above: erring
        // toward the plain price is the safe direction.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SitewideDiscountContext.Provider value={percent}>
      {children}
    </SitewideDiscountContext.Provider>
  );
}

/** The live percentage off, or null when no markdown is running. */
export function useSitewideDiscount(): number | null {
  return React.useContext(SitewideDiscountContext);
}

/**
 * What a price becomes under the running markdown, and what it was.
 *
 * Returns `wasAmount: undefined` when nothing applies, which is precisely what
 * `PriceDisplay` already expects for an ordinary price — so a card can call this
 * unconditionally and pass the result straight through.
 *
 * Rounds the SAVING up, matching the server's rule exactly. If these two
 * disagreed by a piastre the shop would advertise one number and charge
 * another, and the shopper would be right to distrust both.
 */
export function useDiscountedPrice(
  amount: string,
  isMinirueOwned = true,
): { amount: string; wasAmount?: string } {
  const percent = useSitewideDiscount();

  // A partner's price is never cut by MiniRue's campaign — the same rule the
  // server enforces. A card that struck through a collab price would promise a
  // discount that checkout then refuses.
  if (percent === null || !isMinirueOwned) return { amount };

  const minor = Math.round(parseFloat(amount) * 100);
  if (!Number.isFinite(minor) || minor <= 0) return { amount };

  const savingMinor = Math.ceil((minor * Math.round(percent * 100)) / 10000);
  const nextMinor = Math.max(0, minor - savingMinor);

  return {
    amount: (nextMinor / 100).toFixed(2),
    wasAmount: amount,
  };
}
