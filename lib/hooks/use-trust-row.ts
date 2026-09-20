'use client';

/**
 * The two reads the product page's trust row needs beyond shipping and COD
 * (frontend#189), which `components/storefront/cart/use-bag-pricing.ts`
 * already covers: same-day fulfillment settings and the dashboard's trust
 * block (returns window, packaging line, WhatsApp, support hours).
 *
 * Same memoised-promise shape as `use-bag-pricing.ts` and for the same
 * reason: one `/settings/public` read per page load, shared by every
 * component that asks, not one per mounted chip.
 */

import React from 'react';
import { loadDeliverySettings, loadTrustSettings, type PublicTrustSettings } from '@/lib/api/settings';
import { DEFAULT_DELIVERY_SETTINGS, type DeliverySettings } from '@/lib/checkout/delivery';

let deliverySettingsPromise: Promise<DeliverySettings> | null = null;
let trustSettingsPromise: Promise<PublicTrustSettings> | null = null;

/** Test seam: drops both memoised reads so each case starts clean. */
export function resetTrustRowCaches(): void {
  deliverySettingsPromise = null;
  trustSettingsPromise = null;
}

/** Standard / same-day fulfillment settings, `DEFAULT_DELIVERY_SETTINGS` until loaded. */
export function useDeliverySettings(): DeliverySettings {
  const [value, setValue] = React.useState<DeliverySettings>(DEFAULT_DELIVERY_SETTINGS);

  React.useEffect(() => {
    let cancelled = false;
    deliverySettingsPromise ??= loadDeliverySettings();
    void deliverySettingsPromise.then((next) => {
      if (!cancelled) setValue(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return value;
}

/** The dashboard's trust promises, `null` until the read resolves. `null`
 *  fields inside it (not "not loaded yet") mean the owner has not set that
 *  one — both states render no chip, so most callers can treat them alike. */
export function useTrustSettings(): PublicTrustSettings | null {
  const [value, setValue] = React.useState<PublicTrustSettings | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    trustSettingsPromise ??= loadTrustSettings();
    void trustSettingsPromise.then((next) => {
      if (!cancelled) setValue(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return value;
}
