import {
  DEFAULT_DELIVERY_SETTINGS,
  availableDeliveryMethods,
  isSameDayEligible,
  parseGoogleMapsUrl,
  resolveDeliveryLocation,
  resolveDeliverySettings,
  sameDayFeeCopy,
  sameDayWindow,
  type DeliverySettings,
} from '@/lib/checkout/delivery';

/**
 * frontend#163 — delivery method availability and Today/Tomorrow labelling.
 *
 * The window tests use a FIXED clock (`jest.useFakeTimers`) so "today" and
 * "tomorrow" are never a function of when CI happens to run, and cover the
 * three cases the owner's binding decision names: just-before cutoff,
 * exactly-at cutoff, and the UTC-vs-Cairo midnight edge (a moment that is one
 * calendar day in UTC and the next in Africa/Cairo, UTC+2/+3).
 */

const settings: DeliverySettings = {
  standard: { enabled: true, etaLabel: '2–5 working days' },
  sameDay: {
    enabled: true,
    governorates: ['CAIRO', 'GIZA'],
    windowStart: '19:00',
    windowEnd: '24:00',
    cutoff: '17:00',
    feeRangeMinor: { min: 9000, max: 16000 },
    disclaimer: 'Same-day delivery fees usually range from EGP 90 to 160.',
    timezone: 'Africa/Cairo',
  },
};

describe('resolveDeliverySettings', () => {
  it('falls back to defaults for an older backend with no delivery block', () => {
    expect(resolveDeliverySettings(undefined)).toEqual(DEFAULT_DELIVERY_SETTINGS);
    expect(resolveDeliverySettings(null)).toEqual(DEFAULT_DELIVERY_SETTINGS);
  });

  it('reads a well-formed published block through unchanged', () => {
    expect(resolveDeliverySettings(settings)).toEqual(settings);
  });

  it('drops a malformed governorates array entry rather than throwing', () => {
    const resolved = resolveDeliverySettings({
      ...settings,
      sameDay: { ...settings.sameDay, governorates: ['CAIRO', 42, null, 'GIZA'] },
    });
    expect(resolved.sameDay.governorates).toEqual(['CAIRO', 'GIZA']);
  });
});

describe('isSameDayEligible / availableDeliveryMethods', () => {
  it('is eligible for an enabled governorate in the list', () => {
    expect(isSameDayEligible(settings, 'CAIRO')).toBe(true);
    expect(isSameDayEligible(settings, 'GIZA')).toBe(true);
  });

  it('is not eligible for a governorate outside the list', () => {
    expect(isSameDayEligible(settings, 'ASWAN')).toBe(false);
  });

  it('is not eligible with no governorate selected', () => {
    expect(isSameDayEligible(settings, null)).toBe(false);
  });

  it('is not eligible when sameDay is disabled, even for a listed governorate', () => {
    const disabled: DeliverySettings = {
      ...settings,
      sameDay: { ...settings.sameDay, enabled: false },
    };
    expect(isSameDayEligible(disabled, 'CAIRO')).toBe(false);
  });

  it('Giza: both methods available, not standard-only', () => {
    const result = availableDeliveryMethods(settings, 'GIZA');
    expect(result).toEqual({ standard: true, sameDay: true, standardOnly: false });
  });

  it('Aswan: standard only, flagged standardOnly for the auto-select note', () => {
    const result = availableDeliveryMethods(settings, 'ASWAN');
    expect(result).toEqual({ standard: true, sameDay: false, standardOnly: true });
  });

  it('no governorate yet: standard only (nothing to check eligibility against)', () => {
    const result = availableDeliveryMethods(settings, null);
    expect(result).toEqual({ standard: true, sameDay: false, standardOnly: true });
  });
});

describe('sameDayWindow — Today/Tomorrow with a fixed Cairo clock', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('16:59 Cairo (before 17:00 cutoff) labels Today', () => {
    // 16:59 Africa/Cairo (UTC+3 in September, EEST) = 13:59 UTC.
    jest.useFakeTimers().setSystemTime(new Date('2026-09-15T13:59:00Z'));
    const w = sameDayWindow(settings, new Date());
    expect(w.which).toBe('today');
    expect(w.date).toBe('2026-09-15');
    expect(w.label).toBe('Today, 19:00–24:00');
  });

  it('17:00 Cairo (exactly at cutoff) labels Tomorrow', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-15T14:00:00Z'));
    const w = sameDayWindow(settings, new Date());
    expect(w.which).toBe('tomorrow');
    expect(w.date).toBe('2026-09-16');
    expect(w.label).toBe('Tomorrow, 19:00–24:00');
  });

  it('UTC-vs-Cairo midnight edge: 01:00 Cairo is still the SAME UTC calendar day at 22:00 UTC the day before', () => {
    // 2026-09-16T01:00 Africa/Cairo == 2026-09-15T22:00Z. Before cutoff (01:00 < 17:00) → today == Cairo's date, 2026-09-16.
    jest.useFakeTimers().setSystemTime(new Date('2026-09-15T22:00:00Z'));
    const w = sameDayWindow(settings, new Date());
    expect(w.which).toBe('today');
    // The Cairo wall-clock date, NOT the UTC date — this is the whole point of the edge case.
    expect(w.date).toBe('2026-09-16');
  });

  it('23:30 UTC is 02:30 Cairo the next day, still before cutoff', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-15T23:30:00Z'));
    const w = sameDayWindow(settings, new Date());
    expect(w.which).toBe('today');
    expect(w.date).toBe('2026-09-16');
  });
});

describe('sameDayFeeCopy', () => {
  it('renders the owner-specified copy from feeRangeMinor', () => {
    expect(sameDayFeeCopy({ min: 9000, max: 16000 })).toBe(
      'Fee confirmed after your order, usually EGP 90–160, paid in cash on delivery.',
    );
  });
});

describe('parseGoogleMapsUrl / resolveDeliveryLocation', () => {
  it('parses an @lat,lng,zoom link', () => {
    expect(parseGoogleMapsUrl('https://www.google.com/maps/@30.0444,31.2357,15z')).toEqual({
      lat: 30.0444,
      lng: 31.2357,
    });
  });

  it('parses a ?q=lat,lng link', () => {
    expect(parseGoogleMapsUrl('https://maps.google.com/?q=30.0444,31.2357')).toEqual({
      lat: 30.0444,
      lng: 31.2357,
    });
  });

  it('returns null for a link with no coordinates', () => {
    expect(parseGoogleMapsUrl('https://maps.google.com/maps/place/Cairo')).toBeNull();
  });

  it('prefers a dropped pin over a pasted link', () => {
    expect(resolveDeliveryLocation({ lat: 1, lng: 2 }, 'https://maps.google.com/?q=9,9')).toEqual({
      lat: 1,
      lng: 2,
    });
  });

  it('falls back to a parsed pasted link when there is no pin', () => {
    expect(resolveDeliveryLocation(null, 'https://maps.google.com/?q=30.1,31.2')).toEqual({
      lat: 30.1,
      lng: 31.2,
    });
  });

  it('falls back to the raw https link when it has no parseable coordinates', () => {
    expect(resolveDeliveryLocation(null, 'https://maps.app.goo.gl/abcXYZ')).toEqual({
      mapsUrl: 'https://maps.app.goo.gl/abcXYZ',
    });
  });

  it('returns null with no pin and no usable link — the caller must block submission', () => {
    expect(resolveDeliveryLocation(null, '')).toBeNull();
    expect(resolveDeliveryLocation(null, 'not a url')).toBeNull();
  });
});
