'use client';

import React, { useMemo } from 'react';
import Icon from '@/components/ui/Icon';
import { useLoadedShipping, useCodMaxOrderMinor } from './cart/use-bag-pricing';
import { useDeliverySettings, useTrustSettings } from '@/lib/hooks/use-trust-row';
import { resolveFreeDelivery, resolveSameDayGovernorates, resolveCodAvailable } from '@/lib/checkout/trust-row';
import { resolvePromises, type PromiseFacts } from '@/lib/storefront/promises';
import type { ProductPerk } from '@/lib/api/storefront';
import { usePreviewId } from '@/lib/hooks/storefront-preview';

/** What the server already resolved, so the block is whole in the first HTML. */
export interface InitialPromiseFacts {
  freeEverywhere: boolean;
  freeGovernorates: string[];
  sameDayGovernorates: string[];
  deliveryDays: string | null;
  returnsDays: number | null;
  codMaxOrderMinor: number | null;
}

interface ProductPromisesProps {
  /** The owner's rows, straight from Storefront → Product section. */
  perks: ProductPerk[];
  /** The price actually shown for the selected variant — what cash on delivery is judged against. */
  priceAmount: string;
  /** The delivery estimate the page already derived from shipping settings. */
  deliveryLine: string | null;
  /** Reviews this product has, so a "reviews" promise can be honest. */
  reviewsCount: number;
  /**
   * Resolved on the server. Without it the free-delivery promise — the most
   * persuasive one the shop has — appeared only after hydration, so it missed
   * the first paint and no crawler ever saw it.
   */
  initial?: InitialPromiseFacts;
}

/**
 * What the shop promises, on every product page (#189).
 *
 * One block, not two: this replaced a derived sentence AND a separate perks
 * strip that were rendering the same claims twice, one under the other. The
 * words are the dashboard's, the permission is the settings'.
 *
 * The composition is deliberately not a badge strip. This page is a
 * photograph beside an editorial column — a serif name, a price, a rule, a
 * paragraph — so the promises read as a short list set under a hairline, in
 * the label face, with the mark sitting in its own narrow column so the
 * sentences align down a single left edge. Two columns from 720px because
 * four one-line promises stacked vertically push the CTA off a laptop screen;
 * one column below that, where a phone reads better in a single stream.
 */
export default function ProductPromises({ perks, priceAmount, deliveryLine, reviewsCount, initial }: ProductPromisesProps) {
  const shipping = useLoadedShipping();
  const codMaxMinor = useCodMaxOrderMinor();
  const delivery = useDeliverySettings();
  const trust = useTrustSettings();
  // Draft-preview tag (#193); undefined, so absent, on the live shop.
  const previewId = usePreviewId('promises');

  const promises = useMemo(() => {
    // Live settings win once they have loaded; until then the server's own
    // reading stands in, so nothing pops into place after hydration.
    const free = shipping ? resolveFreeDelivery(shipping) : null;
    const liveSameDay = resolveSameDayGovernorates(delivery);
    const facts: PromiseFacts = {
      freeEverywhere: shipping ? (free?.allFree ?? false) : (initial?.freeEverywhere ?? false),
      freeGovernorates: shipping ? (free?.governorateLabels ?? []) : (initial?.freeGovernorates ?? []),
      sameDayGovernorates: liveSameDay.length ? liveSameDay : (initial?.sameDayGovernorates ?? []),
      codAvailable: resolveCodAvailable(priceAmount, codMaxMinor ?? initial?.codMaxOrderMinor ?? null),
      codLimit: null,
      deliveryDays: deliveryLine ?? initial?.deliveryDays ?? null,
      returnsDays: trust?.returnsWindowDays ?? initial?.returnsDays ?? null,
      fee: null,
      hasReviews: reviewsCount > 0,
    };
    return resolvePromises(perks, facts);
  }, [perks, shipping, codMaxMinor, delivery, trust, priceAmount, deliveryLine, reviewsCount, initial]);

  if (promises.length === 0) return null;

  return (
    <ul
      className="mr-promises"
      data-trace-id="PG-STOREFRONT-CAT-005::EL-REGION-product-promises"
      data-testid="product-promises"
      data-count={promises.length}
      data-preview-id={previewId}
    >
      {promises.map((promise) => (
        <li key={promise.id} className="mr-promises__row" data-trace-id={`PG-STOREFRONT-CAT-005::EL-TEXT-product-promise@${promise.id}`}>
          <span className="mr-promises__mark" aria-hidden="true">
            <Icon name={promise.icon} size={16} stroke={1.25} />
          </span>
          <span className="mr-promises__text">{promise.text}</span>
        </li>
      ))}
    </ul>
  );
}
