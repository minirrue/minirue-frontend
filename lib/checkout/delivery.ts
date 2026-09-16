/**
 * Delivery methods — Standard / Same-day (frontend#163, backend#186).
 *
 * The owner's ask, verbatim: "customer must choose which fulfillment delivery
 * type before purchase with the enum of governorate selected." This module is
 * the pure logic half: what methods are available for a governorate, and how
 * the same-day window is labelled ("Today" vs "Tomorrow") in Africa/Cairo
 * time. No React, no fetch — so it is cheap to test with a fixed clock and
 * cheap to import from both the checkout step and the order/confirmation
 * pages.
 *
 * Shapes below mirror `GET /v1/settings/public`'s `delivery` block exactly,
 * as pinned in the coordinator's comment on minirue-backend#186.
 */

import type { GovernorateKey } from './governorates';

export type DeliveryMethod = 'STANDARD' | 'SAME_DAY';

export interface FeeRangeMinor {
  min: number;
  max: number;
}

export interface StandardDeliverySettings {
  enabled: boolean;
  etaLabel: string;
}

export interface SameDayDeliverySettings {
  enabled: boolean;
  governorates: GovernorateKey[];
  /** 'HH:mm' */
  windowStart: string;
  /** 'HH:mm' or '24:00' */
  windowEnd: string;
  /** 'HH:mm' */
  cutoff: string;
  feeRangeMinor: FeeRangeMinor;
  disclaimer: string;
  /** Public-only, computed server-side. Always 'Africa/Cairo' today. */
  timezone: string;
}

export interface DeliverySettings {
  standard: StandardDeliverySettings;
  sameDay: SameDayDeliverySettings;
}

/** What the shop looks like when `/settings/public` has no `delivery` block yet (older backend). */
export const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
  standard: { enabled: true, etaLabel: '2–5 working days' },
  sameDay: {
    enabled: false,
    governorates: [],
    windowStart: '19:00',
    windowEnd: '24:00',
    cutoff: '17:00',
    feeRangeMinor: { min: 9000, max: 16000 },
    disclaimer:
      'Same-day delivery fees usually range from EGP 90 to 160. We confirm the exact fee after your order is confirmed, and you pay it in cash on delivery.',
    timezone: 'Africa/Cairo',
  },
};

/** Guards an unknown `/settings/public` payload the same way the rest of `lib/api/settings.ts` does. */
export function resolveDeliverySettings(published: unknown): DeliverySettings {
  const p = (published ?? {}) as Partial<DeliverySettings> | null;
  if (!p || typeof p !== 'object') return DEFAULT_DELIVERY_SETTINGS;

  const standard =
    p.standard && typeof p.standard === 'object'
      ? {
          enabled:
            typeof p.standard.enabled === 'boolean'
              ? p.standard.enabled
              : DEFAULT_DELIVERY_SETTINGS.standard.enabled,
          etaLabel:
            typeof p.standard.etaLabel === 'string' && p.standard.etaLabel.trim()
              ? p.standard.etaLabel
              : DEFAULT_DELIVERY_SETTINGS.standard.etaLabel,
        }
      : DEFAULT_DELIVERY_SETTINGS.standard;

  const sd = p.sameDay;
  const sameDay: SameDayDeliverySettings =
    sd && typeof sd === 'object'
      ? {
          enabled: typeof sd.enabled === 'boolean' ? sd.enabled : false,
          governorates: Array.isArray(sd.governorates)
            ? sd.governorates.filter((g): g is GovernorateKey => typeof g === 'string')
            : [],
          windowStart:
            typeof sd.windowStart === 'string' && sd.windowStart
              ? sd.windowStart
              : DEFAULT_DELIVERY_SETTINGS.sameDay.windowStart,
          windowEnd:
            typeof sd.windowEnd === 'string' && sd.windowEnd
              ? sd.windowEnd
              : DEFAULT_DELIVERY_SETTINGS.sameDay.windowEnd,
          cutoff:
            typeof sd.cutoff === 'string' && sd.cutoff
              ? sd.cutoff
              : DEFAULT_DELIVERY_SETTINGS.sameDay.cutoff,
          feeRangeMinor:
            sd.feeRangeMinor &&
            typeof sd.feeRangeMinor.min === 'number' &&
            typeof sd.feeRangeMinor.max === 'number'
              ? { min: sd.feeRangeMinor.min, max: sd.feeRangeMinor.max }
              : DEFAULT_DELIVERY_SETTINGS.sameDay.feeRangeMinor,
          disclaimer:
            typeof sd.disclaimer === 'string' && sd.disclaimer.trim()
              ? sd.disclaimer
              : DEFAULT_DELIVERY_SETTINGS.sameDay.disclaimer,
          timezone:
            typeof sd.timezone === 'string' && sd.timezone
              ? sd.timezone
              : DEFAULT_DELIVERY_SETTINGS.sameDay.timezone,
        }
      : DEFAULT_DELIVERY_SETTINGS.sameDay;

  return { standard, sameDay };
}

/**
 * Whether same-day can be OFFERED for this governorate — settings enabled AND
 * the governorate in `sameDay.governorates`. Never depends on the cutoff: the
 * owner's binding decision is that same-day stays selectable after the
 * cutoff, only relabelled "Tomorrow".
 */
export function isSameDayEligible(
  settings: DeliverySettings,
  governorate: GovernorateKey | null,
): boolean {
  if (!settings.sameDay.enabled) return false;
  if (!governorate) return false;
  return settings.sameDay.governorates.includes(governorate);
}

export interface AvailableDeliveryMethods {
  standard: boolean;
  sameDay: boolean;
  /**
   * True when only Standard is offered — the one case the owner allows an
   * auto-selected default, with a one-line note ("Only Standard delivery is
   * available for this governorate."). Every other case requires an explicit
   * choice.
   */
  standardOnly: boolean;
}

export function availableDeliveryMethods(
  settings: DeliverySettings,
  governorate: GovernorateKey | null,
): AvailableDeliveryMethods {
  const standard = settings.standard.enabled;
  const sameDay = isSameDayEligible(settings, governorate);
  return { standard, sameDay, standardOnly: standard && !sameDay };
}

// ─────────────────────────────────────────────────────────────────────────────
// Today / Tomorrow window labelling — Africa/Cairo, cutoff-aware
// ─────────────────────────────────────────────────────────────────────────────

function parseHHmm(value: string): { h: number; m: number } {
  const [h, m] = value.split(':').map((n) => parseInt(n, 10));
  return { h: h || 0, m: m || 0 };
}

/**
 * The wall-clock date and time-of-day in `timezone`, read via `Intl` so this
 * works correctly regardless of the host machine's own timezone (the UTC vs.
 * Cairo midnight edge this exists to cover).
 */
function cairoWallClock(now: Date, timezone: string): { dateISO: string; minutesOfDay: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  const dateISO = `${get('year')}-${get('month')}-${get('day')}`;
  // 'hour' can read '24' at exactly local midnight in some ICU builds; fold it.
  const hour = get('hour') === '24' ? 0 : parseInt(get('hour'), 10);
  const minute = parseInt(get('minute'), 10);
  return { dateISO, minutesOfDay: hour * 60 + minute };
}

function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split('-').map((n) => parseInt(n, 10));
  // Construct at UTC noon to dodge any DST-adjacent local-time edge.
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export interface SameDayWindow {
  /** 'today' before the cutoff, 'tomorrow' at/after it — never anything else. */
  which: 'today' | 'tomorrow';
  /** The delivery date, Africa/Cairo, ISO 'YYYY-MM-DD'. */
  date: string;
  start: string;
  end: string;
  /** Customer-facing Egypt-local, 12-hour window label. */
  label: string;
}

/** Formats backend `HH:mm` values for the English Egypt storefront. */
export function formatDeliveryTime(value: string): string {
  const { h, m } = parseHHmm(value);
  const hour = h === 24 ? 0 : h;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const twelveHour = hour % 12 || 12;
  return `${twelveHour}${m ? `:${String(m).padStart(2, '0')}` : ''} ${suffix}`;
}

export function formatDeliveryTimeRange(start: string, end: string): string {
  return `${formatDeliveryTime(start)}–${formatDeliveryTime(end)}`;
}

/**
 * Today vs. Tomorrow, computed entirely from the wall clock in
 * `settings.sameDay.timezone` — never the host's local time. At or after the
 * cutoff the window is tomorrow's; before it, today's. The owner's decision:
 * same-day is NEVER disabled or hidden for being past the cutoff, only
 * relabelled.
 */
export function sameDayWindow(settings: DeliverySettings, now: Date = new Date()): SameDayWindow {
  const { sameDay } = settings;
  const { dateISO, minutesOfDay } = cairoWallClock(now, sameDay.timezone);
  const cutoff = parseHHmm(sameDay.cutoff);
  const cutoffMinutes = cutoff.h * 60 + cutoff.m;

  const isAfterCutoff = minutesOfDay >= cutoffMinutes;
  const which: 'today' | 'tomorrow' = isAfterCutoff ? 'tomorrow' : 'today';
  const date = isAfterCutoff ? addDaysISO(dateISO, 1) : dateISO;
  const label = `${which === 'today' ? 'Today' : 'Tomorrow'}, ${formatDeliveryTimeRange(sameDay.windowStart, sameDay.windowEnd)}`;

  return { which, date, start: sameDay.windowStart, end: sameDay.windowEnd, label };
}

/** "Fee confirmed after your order, usually EGP 90–160, paid in cash on delivery." */
export function sameDayFeeCopy(feeRangeMinor: FeeRangeMinor): string {
  const min = (feeRangeMinor.min / 100).toFixed(0);
  const max = (feeRangeMinor.max / 100).toFixed(0);
  return `Fee confirmed after your order, usually EGP ${min}–${max}, paid in cash on delivery.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// deliveryLocation — pin or a pasted Google Maps link
// ─────────────────────────────────────────────────────────────────────────────

export type DeliveryLocation = { lat: number; lng: number } | { mapsUrl: string };

/** Extracts `lat,lng` from a pasted Google Maps URL, or returns null. Several common shapes. */
export function parseGoogleMapsUrl(input: string): { lat: number; lng: number } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // .../@lat,lng,zoom or .../@lat,lng
  const at = trimmed.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return { lat: parseFloat(at[1]), lng: parseFloat(at[2]) };

  // ?q=lat,lng or &q=lat,lng
  const q = trimmed.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (q) return { lat: parseFloat(q[1]), lng: parseFloat(q[2]) };

  // maps.google.com/maps?ll=lat,lng
  const ll = trimmed.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (ll) return { lat: parseFloat(ll[1]), lng: parseFloat(ll[2]) };

  return null;
}

/**
 * What to send as `deliveryLocation`: coordinates when the pasted link (or the
 * map pin) resolves to lat/lng, otherwise the raw link so the backend still
 * has something to open. Returns null when there is nothing usable at all —
 * the caller must block submission on that for SAME_DAY.
 */
export function resolveDeliveryLocation(
  pin: { lat: number; lng: number } | null,
  pastedMapsUrl: string,
): DeliveryLocation | null {
  if (pin) return { lat: pin.lat, lng: pin.lng };
  const trimmed = pastedMapsUrl.trim();
  if (!trimmed) return null;
  const parsed = parseGoogleMapsUrl(trimmed);
  if (parsed) return parsed;
  if (/^https:\/\/\S+$/i.test(trimmed)) return { mapsUrl: trimmed };
  return null;
}
