import { apiGetPublicSettings, resolveEffectiveShipping } from '@/lib/api/settings';
import { resolveDeliverySettings } from '@/lib/checkout/delivery';
import { resolveFreeDelivery, resolveSameDayGovernorates } from '@/lib/checkout/trust-row';
import { deliveryPerkText } from '@/lib/checkout/delivery-perk';
import type { InitialPromiseFacts } from '@/components/storefront/ProductPromises';

/**
 * The promise facts, resolved on the SERVER so the block is complete in the
 * first HTML.
 *
 * The client hooks that feed these (`useLoadedShipping` and friends) only
 * settle after hydration, which meant the free-delivery promise — the
 * strongest claim this shop can make — was missing from the server HTML
 * entirely: invisible to crawlers, and popping in late for a visitor on a
 * slow connection, which is exactly who it is for.
 *
 * Every field degrades to "cannot prove it" rather than to a guess, so a
 * settings call that fails simply shows fewer promises.
 */
export async function loadPromiseFacts(): Promise<InitialPromiseFacts | undefined> {
  try {
    const published = await apiGetPublicSettings();
    const shipping = resolveEffectiveShipping(published);
    const free = resolveFreeDelivery(shipping);
    const delivery = resolveDeliverySettings((published as { delivery?: unknown }).delivery);
    const trust = (published as { trust?: { returnsWindowDays?: number | null } }).trust ?? null;

    return {
      freeEverywhere: free?.allFree ?? false,
      freeGovernorates: free?.governorateLabels ?? [],
      sameDayGovernorates: resolveSameDayGovernorates(delivery),
      deliveryDays: deliveryPerkText(shipping),
      returnsDays: typeof trust?.returnsWindowDays === 'number' ? trust.returnsWindowDays : null,
      codMaxOrderMinor:
        typeof (published as { payments?: { codMaxOrderMinor?: number | null } }).payments?.codMaxOrderMinor === 'number'
          ? (published as { payments: { codMaxOrderMinor: number } }).payments.codMaxOrderMinor
          : null,
    };
  } catch {
    // A shop that cannot read its own settings promises nothing.
    return undefined;
  }
}
