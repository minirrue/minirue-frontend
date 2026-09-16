'use client';

import React from 'react';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
// Leaflet's own stylesheet. Safe to import here because this whole module is
// only ever reached through a `next/dynamic(..., { ssr: false })` wrapper at
// the call site (DeliveryMethodStep.tsx) — it never touches the server
// bundle or the root layout's critical CSS path.
import 'leaflet/dist/leaflet.css';

/**
 * The Leaflet pin-drop map for same-day delivery (frontend#163).
 *
 * Deliberately does NOT do its own `next/dynamic` — the instruction (and the
 * reason `ssr: false` works at all) is that the dynamic import lives at the
 * CALL SITE, so this file can be a perfectly normal client component and the
 * caller decides when Leaflet's JS ever reaches the browser.
 */

/** Egypt's rough centre — Cairo — used only until a pin exists. */
const DEFAULT_CENTER: [number, number] = [30.0444, 31.2357];
const DEFAULT_ZOOM = 12;
const PIN_ZOOM = 15;

/**
 * A drawn pin rather than Leaflet's default marker image. The default relies
 * on `marker-icon.png` etc. resolving through whatever asset pipeline the
 * host app uses, which breaks under Next's bundler unless every consumer
 * remembers to patch `L.Icon.Default` — a divIcon has no asset path to get
 * wrong.
 */
const pinIcon = L.divIcon({
  className: 'mr-delivery-pin',
  html:
    '<svg width="30" height="42" viewBox="0 0 30 42" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M15 0C6.716 0 0 6.716 0 15c0 10.5 15 27 15 27s15-16.5 15-27c0-8.284-6.716-15-15-15z" fill="#1a1a1a"/>' +
    '<circle cx="15" cy="15" r="6" fill="#fff"/>' +
    '</svg>',
  iconSize: [30, 42],
  iconAnchor: [15, 42],
});

export interface DeliveryMapPin {
  lat: number;
  lng: number;
}

interface DeliveryMapProps {
  /** The dropped pin, or `null` before the shopper has placed one. */
  pin: DeliveryMapPin | null;
  /** Fired on click-to-drop and on drag-end, with the new coordinates. */
  onChange: (pin: DeliveryMapPin) => void;
}

/** Click anywhere on the map to drop (or move) the pin. */
function ClickToDrop({ onChange }: { onChange: (pin: DeliveryMapPin) => void }) {
  useMapEvents({
    click(e) {
      onChange({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export default function DeliveryMap({ pin, onChange }: DeliveryMapProps) {
  const center: [number, number] = pin ? [pin.lat, pin.lng] : DEFAULT_CENTER;

  return (
    <div
      style={{
        borderRadius: 'var(--mr-radius-md)',
        overflow: 'hidden',
        border: '1px solid var(--mr-hairline)',
        // Leaflet needs an explicit height; a percentage height with no
        // sized ancestor collapses to 0 and shows a grey box.
        height: 280,
      }}
    >
      <MapContainer
        center={center}
        zoom={pin ? PIN_ZOOM : DEFAULT_ZOOM}
        style={{ width: '100%', height: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickToDrop onChange={onChange} />
        {pin && (
          <Marker
            position={[pin.lat, pin.lng]}
            icon={pinIcon}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const marker = e.target as L.Marker;
                const { lat, lng } = marker.getLatLng();
                onChange({ lat, lng });
              },
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
