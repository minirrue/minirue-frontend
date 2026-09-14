'use client';

import type { ApiProduct, ProductVariant } from '@/lib/api/catalog';
import { cheapestActiveVariant } from '@/lib/api/catalog';
import {
  offerPriceMinor,
  useDiscountedPrice,
  useSitewideOffer,
  type SitewideOffer,
} from '@/lib/hooks/use-sitewide-discount';
import PriceDisplay from './PriceDisplay';

/**
 * The variant a card should quote: the one that is cheapest AFTER the running
 * offer. Without floor caps that is always the cheapest variant before it, so
 * nothing changes; with a cap, a cheaper variant can be held at its floor while
 * a dearer one drops below it, and quoting the wrong one would print a price
 * checkout never charges.
 */
function cheapestVariantUnderOffer(
  product: ApiProduct,
  offer: SitewideOffer,
  eligible: boolean,
): ProductVariant | null {
  const cheapest = cheapestActiveVariant(product);
  if (!eligible || offer.percent === null || !Object.keys(offer.cappedOffers).length) {
    return cheapest;
  }
  let best: ProductVariant | null = null;
  let bestMinor = Infinity;
  for (const variant of product.variants ?? []) {
    if (!variant.isActive) continue;
    const minor = Math.round(parseFloat(variant.priceAmount) * 100);
    if (!Number.isFinite(minor) || minor <= 0) continue;
    const shown = offerPriceMinor(minor, offer.percent, offer.cappedOffers[variant.id]);
    if (shown < bestMinor) {
      best = variant;
      bestMinor = shown;
    }
  }
  return best ?? cheapest;
}

/**
 * The one way a product card prints a price.
 *
 * There were two card components and only one of them did this. The home page's
 * `ProductCard` interpolated the raw value:
 *
 *     {price.currency} {price.amount}
 *
 * `price.amount` is a `NUMERIC(*,4)` string straight off the wire, so the home
 * page read `EGP 799.0000` — and, because the interpolation skipped the hook
 * too, showed no sitewide discount on products `/shop/all` was striking through
 * at the same moment (#1). One line, both symptoms.
 *
 * Split out here rather than copied into the second card, because two divergent
 * price renderers is the actual defect and a copy would let them drift again.
 * Any new card renders a price through this or it is wrong.
 *
 * A hook cannot be called inside a `price && …` branch, which is why this is a
 * component and not a helper.
 */
export default function CardPrice({
  price,
  product,
  style,
}: {
  price: { amount: string; currency: string };
  product: ApiProduct;
  /** Card-specific typography; the defaults already match both grids. */
  style?: React.CSSProperties;
}) {
  // The server's answer, not `!product.collaboratorId`. Ownership is the
  // product AND its brand, and only the API sees both — this local check
  // struck through prices on partner-brand products that checkout charged in
  // full (#3). `?? false` so an older response without the field shows the
  // real price rather than a discount that will not be honoured.
  const eligible = product.isMinirueOwned ?? false;
  const offer = useSitewideOffer();
  const quoted = cheapestVariantUnderOffer(product, offer, eligible);
  const shown = useDiscountedPrice(
    quoted?.priceAmount ?? price.amount,
    eligible,
    quoted?.id,
  );
  return (
    <PriceDisplay
      amount={shown.amount}
      wasAmount={shown.wasAmount}
      currency={price.currency}
      style={style}
    />
  );
}
