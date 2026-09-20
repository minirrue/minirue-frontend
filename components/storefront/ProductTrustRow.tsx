'use client';

import React from 'react';
import { useLoadedShipping, useCodMaxOrderMinor } from './cart/use-bag-pricing';
import { useDeliverySettings, useTrustSettings } from '@/lib/hooks/use-trust-row';
import { resolveFreeDelivery, resolveSameDayGovernorates, resolveCodAvailable } from '@/lib/checkout/trust-row';

interface ProductTrustRowProps {
  /** The price actually shown for the selected variant — what COD is judged against. */
  priceAmount: string;
}

/**
 * The persuasion gate (frontend#189) — every claim here traces to a live
 * setting, never a hardcoded promise.
 *
 * The owner's ask, verbatim: "if dashboard says 0 shipping then advertise on
 * product page free shipping, also high quality packaging premium one, also
 * shipping on same day in cairo and giza as marked on dashboard". Nothing
 * below names a governorate, a fee or a day count that is not read off the
 * same settings checkout already trusts — `useLoadedShipping` /
 * `useCodMaxOrderMinor` (the bag's own reads, shared here rather than
 * duplicated) and `useDeliverySettings` / `useTrustSettings` for the rest.
 *
 * Rendered as one quiet line of short phrases, not a strip of badges — this
 * shop's product page already reads as an editorial page beside a
 * photograph, and a row of icon-boxed pills would be the "bolted-on badge
 * strip" the brief explicitly asked this NOT to look like. A phrase that
 * cannot be filled from settings is simply not in the line; an empty result
 * renders nothing, not an empty rule or heading.
 */
export default function ProductTrustRow({ priceAmount }: ProductTrustRowProps) {
  const shipping = useLoadedShipping();
  const codMaxMinor = useCodMaxOrderMinor();
  const delivery = useDeliverySettings();
  const trust = useTrustSettings();

  const phrases: string[] = [];

  // Free delivery — only when the settings prove it, and naming the
  // governorates when it is not everywhere.
  if (shipping) {
    const free = resolveFreeDelivery(shipping);
    if (free?.allFree) {
      phrases.push('Free delivery across Egypt');
    } else if (free && free.governorateLabels.length > 0) {
      phrases.push(`Free delivery in ${joinNames(free.governorateLabels)}`);
    }
  }

  // Same-day — named governorates only, never a hardcoded pair of cities.
  const sameDayGovernorates = resolveSameDayGovernorates(delivery);
  if (sameDayGovernorates.length > 0) {
    phrases.push(`Same-day delivery in ${joinNames(sameDayGovernorates)}`);
  }

  // Cash on delivery — gated on THIS product's price against the shop's own
  // ceiling, not a blanket "COD available".
  if (resolveCodAvailable(priceAmount, codMaxMinor)) {
    phrases.push('Cash on delivery');
  }

  // Returns window — the dashboard's own day count, never invented.
  if (trust?.returnsWindowDays && trust.returnsWindowDays > 0) {
    const days = trust.returnsWindowDays;
    phrases.push(`${days}-day returns`);
  }

  if (phrases.length === 0 && !trust?.packagingPromise) return null;

  return (
    <div
      data-testid="product-trust-row"
      data-trace-id="PG-STOREFRONT-CAT-005::EL-REGION-product-trust-row"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        marginBottom: 28,
        animation: 'mr-word-in 0.5s cubic-bezier(0.16,1,0.3,1) both',
        animationDelay: '340ms',
      }}
    >
      {phrases.length > 0 && (
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--mr-font-ui)',
            fontSize: 'var(--mr-text-xs)',
            letterSpacing: '0.01em',
            lineHeight: 1.6,
            color: 'var(--mr-fg-2)',
          }}
        >
          {phrases.map((phrase, i) => (
            <React.Fragment key={phrase}>
              {i > 0 && <span style={{ color: 'var(--mr-fg-4)' }}> · </span>}
              {phrase}
            </React.Fragment>
          ))}
        </p>
      )}
      {/* Printed verbatim, on its own line — prose, not a token to weave into
          the phrase list above. Assumed field name; see PublicTrustSettings. */}
      {trust?.packagingPromise && (
        <p
          data-trace-id="PG-STOREFRONT-CAT-005::EL-TEXT-packaging-promise"
          style={{
            margin: 0,
            fontFamily: 'var(--mr-font-ui)',
            fontSize: 'var(--mr-text-xs)',
            lineHeight: 1.6,
            color: 'var(--mr-fg-2)',
          }}
        >
          {trust.packagingPromise}
        </p>
      )}
    </div>
  );
}

/** "Cairo" / "Cairo & Giza" / "Cairo, Giza & Alexandria" — never a bare list
 *  with a trailing comma, and never an Oxford comma this shop's other copy
 *  does not use (see ShareButton's byline join). */
function joinNames(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}
