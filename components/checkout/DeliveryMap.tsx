'use client';

import React from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import Button from '@/components/ui/Button';
import { CheckoutAlert } from '@/components/checkout/checkout-ui';

const DEFAULT_CENTER = { lat: 30.0444, lng: 31.2357 };
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const GEO_OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 };

export interface DeliveryMapPin { lat: number; lng: number }
interface DeliveryMapProps { pin: DeliveryMapPin | null; onChange: (pin: DeliveryMapPin | null) => void; onConfirmedMapsUrlChange?: (url: string) => void }
function mapsUrl(pin: DeliveryMapPin) { return `https://www.google.com/maps?q=${pin.lat.toFixed(6)},${pin.lng.toFixed(6)}`; }

export default function DeliveryMap({ pin, onChange, onConfirmedMapsUrlChange }: DeliveryMapProps) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<maplibregl.Map | null>(null);
  const [draft, setDraft] = React.useState<DeliveryMapPin>(pin ?? DEFAULT_CENTER);
  const [confirmedPin, setConfirmedPin] = React.useState<DeliveryMapPin | null>(pin);
  const [editing, setEditing] = React.useState(!pin);
  const [ready, setReady] = React.useState(false);
  const [mapError, setMapError] = React.useState<string | null>(null);
  const [geoError, setGeoError] = React.useState<string | null>(null);
  const [locating, setLocating] = React.useState(false);

  React.useEffect(() => {
    if (!hostRef.current) return;
    const map = new maplibregl.Map({ container: hostRef.current, style: MAP_STYLE, center: [draft.lng, draft.lat], zoom: pin ? 16 : 12, attributionControl: false });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }));
    const syncCenter = () => {
      const center = map.getCenter();
      setDraft({ lat: center.lat, lng: center.lng });
    };
    setReady(true);
    const loadTimeout = window.setTimeout(() => setMapError('The map could not load. Paste a Google Maps link below to continue.'), 8_000);
    map.on('load', () => { window.clearTimeout(loadTimeout); setMapError(null); });
    map.on('moveend', syncCenter);
    mapRef.current = map;
    return () => { window.clearTimeout(loadTimeout); map.remove(); mapRef.current = null; };
  }, []);

  React.useEffect(() => {
    if (!pin || !mapRef.current) return;
    mapRef.current.setCenter([pin.lng, pin.lat]);
    setDraft(pin);
    setConfirmedPin(pin);
  }, [pin]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setGeoError('Location is unavailable in this browser. Move the map or paste a Google Maps link.');
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const next = { lat: coords.latitude, lng: coords.longitude };
        mapRef.current?.jumpTo({ center: [next.lng, next.lat], zoom: 17 });
        setDraft(next);
        setEditing(true);
        setConfirmedPin(null);
        onChange(null);
        setLocating(false);
      },
      (error) => {
        const message = error.code === error.PERMISSION_DENIED ? 'Location permission was denied. Allow access, move the map, or paste a Google Maps link.' : error.code === error.TIMEOUT ? 'Finding your location timed out. Try again, move the map, or paste a link.' : 'Your location is unavailable. Move the map or paste a Google Maps link.';
        setGeoError(message);
        setLocating(false);
      },
      GEO_OPTIONS,
    );
  }

  function confirm() {
    onChange(draft);
    onConfirmedMapsUrlChange?.(mapsUrl(draft));
    setConfirmedPin(draft);
    setEditing(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ position: 'relative', height: 300, overflow: 'hidden', borderRadius: 'var(--mr-radius-md)', border: '1px solid var(--mr-hairline)', background: 'var(--mr-cream-200)' }}>
        <div ref={hostRef} aria-label="Drop-off map" style={{ width: '100%', height: '100%' }} />
        {ready && editing && <svg aria-hidden="true" width="34" height="46" viewBox="0 0 34 46" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -100%)', pointerEvents: 'none', filter: 'drop-shadow(0 5px 6px rgb(0 0 0 / 24%))' }}><path d="M17 1C8.16 1 1 8.16 1 17c0 11.2 16 28 16 28s16-16.8 16-28C33 8.16 25.84 1 17 1Z" fill="var(--mr-fg)" stroke="var(--mr-bg-raised, #fff)" strokeWidth="2" /><circle cx="17" cy="17" r="6" fill="var(--mr-bg-raised, #fff)" /></svg>}
        {ready && !editing && <div data-testid="delivery-map-lock" aria-hidden="true" style={{ position: 'absolute', inset: 0, cursor: 'not-allowed', background: 'transparent' }} />}
      </div>
      {mapError && <CheckoutAlert variant="info">{mapError}</CheckoutAlert>}
      {geoError && <CheckoutAlert variant="info">{geoError}</CheckoutAlert>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Button type="button" variant="outline" size="sm" onClick={useMyLocation} disabled={locating || !ready} style={{ minWidth: 168 }}>{locating ? 'Finding your location…' : 'Use my location'}</Button>
        {editing ? <Button type="button" size="sm" onClick={confirm} disabled={!ready} style={{ minWidth: 214 }}>Confirm drop-off location</Button> : <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)} style={{ minWidth: 168 }}>Adjust location</Button>}
      </div>
      {!editing && confirmedPin && <div aria-live="polite" style={{ fontFamily: 'var(--mr-font-ui)', fontSize: 'var(--mr-text-sm)', color: 'var(--mr-fg-2)' }}>Location confirmed · <a href={mapsUrl(confirmedPin)} target="_blank" rel="noreferrer">Open in Google Maps</a></div>}
      <output hidden data-testid="delivery-map-center" data-lat={draft.lat} data-lng={draft.lng} data-confirmed={!editing && !!confirmedPin} />
    </div>
  );
}
