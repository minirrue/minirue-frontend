'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import {
  sameDayFeeCopy,
  sameDayWindow,
  type AvailableDeliveryMethods,
  type DeliveryMethod,
  type DeliverySettings,
} from '@/lib/checkout/delivery';
import { CheckoutAlert, CheckoutOption } from '@/components/checkout/checkout-ui';
import Button from '@/components/ui/Button';
import type { DeliveryMapPin } from './DeliveryMap';

/**
 * The delivery-method choice (frontend#163) — Standard / Same-day, tied to
 * the governorate the address step already resolved.
 *
 * THE dynamic import lives here, at the call site of `DeliveryMap`, not
 * inside that file — `DeliveryMap` imports `leaflet`/`react-leaflet` at its
 * top level, so the only way those never reach the server bundle (or a
 * browser that never picks Same-day) is to wrap the import itself in
 * `next/dynamic(..., { ssr: false })`, here, where it is actually used.
 */
const DeliveryMap = dynamic(() => import('./DeliveryMap'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: 280,
        borderRadius: 'var(--mr-radius-md)',
        border: '1px solid var(--mr-hairline)',
        background: 'var(--mr-cream-200)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--mr-font-ui)',
        fontSize: 'var(--mr-text-sm)',
        color: 'var(--mr-fg-3)',
      }}
    >
      Loading map…
    </div>
  ),
});

const mapsInputStyle: React.CSSProperties = {
  font: 'inherit',
  fontSize: 16,
  padding: '12px 14px',
  borderRadius: 8,
  border: '1px solid color-mix(in srgb, var(--mr-fg) 45%, transparent)',
  background: 'var(--mr-bg-raised, #fff)',
  color: 'var(--mr-fg)',
  width: '100%',
  minWidth: 0,
  outline: 'none',
};

interface DeliveryMethodStepProps {
  settings: DeliverySettings;
  available: AvailableDeliveryMethods;
  method: DeliveryMethod | null;
  onMethodChange: (method: DeliveryMethod) => void;
  /** What Standard costs for this governorate, rendered exactly as the summary shows it. */
  standardFeeLabel: React.ReactNode;
  pin: DeliveryMapPin | null;
  onPinChange: (pin: DeliveryMapPin | null) => void;
  pastedMapsUrl: string;
  onPastedMapsUrlChange: (value: string) => void;
  /** Shown under the Same-day card once the shopper has tried to continue with nothing usable. */
  locationError?: string | null;
  now?: Date;
}

export default function DeliveryMethodStep({
  settings,
  available,
  method,
  onMethodChange,
  standardFeeLabel,
  pin,
  onPinChange,
  pastedMapsUrl,
  onPastedMapsUrlChange,
  locationError,
  now,
}: DeliveryMethodStepProps) {
  const [geoError, setGeoError] = React.useState<string | null>(null);
  const [locating, setLocating] = React.useState(false);
  const window_ = sameDayWindow(settings, now);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setGeoError('Your browser does not support location — drop a pin or paste a link instead.');
      return;
    }
    setGeoError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onPinChange({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        setLocating(false);
        // Permission denied, position unavailable, or timeout — every case
        // is handled the same way: an inline message, never a thrown error.
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? 'Location access was denied. Drop a pin on the map or paste a Google Maps link instead.'
            : 'Could not get your location. Drop a pin on the map or paste a Google Maps link instead.',
        );
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  if (!available.standard && !available.sameDay) return null;

  return (
    <div role="radiogroup" aria-label="Delivery method" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--mr-sp-3)' }}>
      {available.standard && (
        <CheckoutOption
          name="deliveryMethod"
          checked={method === 'STANDARD'}
          onChange={() => onMethodChange('STANDARD')}
          title="Standard delivery"
          description={
            <>
              {standardFeeLabel} · {settings.standard.etaLabel}
            </>
          }
        />
      )}

      {available.standardOnly && (
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--mr-font-ui)',
            fontSize: 'var(--mr-text-xs)',
            color: 'var(--mr-fg-4)',
          }}
        >
          Only Standard delivery is available for this governorate.
        </p>
      )}

      {available.sameDay && (
        <>
          <CheckoutOption
            name="deliveryMethod"
            checked={method === 'SAME_DAY'}
            onChange={() => onMethodChange('SAME_DAY')}
            title="Same-day delivery"
            badge={window_.which === 'today' ? 'Today' : undefined}
            description={
              <>
                {window_.label}
                <br />
                {settings.sameDay.disclaimer}
                <br />
                {sameDayFeeCopy(settings.sameDay.feeRangeMinor)}
              </>
            }
          />

          {method === 'SAME_DAY' && (
            <div
              style={{
                padding: 'var(--mr-sp-4) var(--mr-sp-5)',
                borderRadius: 'var(--mr-radius-md)',
                border: '1px solid var(--mr-hairline)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--mr-sp-3)',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontFamily: 'var(--mr-font-label)',
                  fontSize: 'var(--mr-text-xs)',
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--mr-fg-3)',
                }}
              >
                Exact drop-off location
              </p>

              <DeliveryMap pin={pin} onChange={onPinChange} />

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={useMyLocation}
                disabled={locating}
                style={{ alignSelf: 'flex-start' }}
              >
                {locating ? 'Locating…' : 'Use my location'}
              </Button>

              {geoError && <CheckoutAlert variant="info">{geoError}</CheckoutAlert>}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label
                  htmlFor="deliveryMapsUrl"
                  style={{
                    fontFamily: 'var(--mr-font-label)',
                    fontSize: 'var(--mr-text-xs)',
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: 'var(--mr-fg-3)',
                  }}
                >
                  Or paste a Google Maps link
                </label>
                <input
                  id="deliveryMapsUrl"
                  type="url"
                  inputMode="url"
                  placeholder="https://maps.google.com/…"
                  value={pastedMapsUrl}
                  onChange={(e) => onPastedMapsUrlChange(e.target.value)}
                  style={mapsInputStyle}
                />
              </div>

              {locationError && <CheckoutAlert variant="error">{locationError}</CheckoutAlert>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
