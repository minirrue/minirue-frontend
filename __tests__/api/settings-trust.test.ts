import { resolveTrustSettings } from '@/lib/api/settings';

/**
 * frontend#189 / dashboard#125 — the trust block's field names are ASSUMED
 * (dashboard#125 had not posted a settled shape when this shipped), so this
 * pins the tolerant reading rather than a fixed contract: each field accepts
 * a short list of plausible spellings, and anything of the wrong type or
 * missing entirely resolves to `null`, never a guess or a thrown error.
 */
describe('resolveTrustSettings', () => {
  it('is all null for an absent block', () => {
    expect(resolveTrustSettings(undefined)).toEqual({
      returnsWindowDays: null,
      packagingPromise: null,
      whatsappNumber: null,
      supportHours: null,
      deliveryPromiseOverride: null,
    });
  });

  it('is all null for a non-object payload', () => {
    expect(resolveTrustSettings('nonsense')).toEqual({
      returnsWindowDays: null,
      packagingPromise: null,
      whatsappNumber: null,
      supportHours: null,
      deliveryPromiseOverride: null,
    });
  });

  it('reads the assumed field names when present', () => {
    expect(
      resolveTrustSettings({
        returnsWindowDays: 14,
        packagingPromise: 'Premium, tamper-evident packaging on every order.',
        whatsappNumber: '+201234567890',
        supportHours: '10am–8pm, Sat–Thu',
      }),
    ).toEqual({
      returnsWindowDays: 14,
      packagingPromise: 'Premium, tamper-evident packaging on every order.',
      whatsappNumber: '+201234567890',
      supportHours: '10am–8pm, Sat–Thu',
      deliveryPromiseOverride: null,
    });
  });

  it('accepts alternate spellings for the returns window', () => {
    expect(resolveTrustSettings({ returnWindowDays: 7 }).returnsWindowDays).toBe(7);
    expect(resolveTrustSettings({ returnsWindow: 30 }).returnsWindowDays).toBe(30);
  });

  it('drops a string that survived storage where a number belongs', () => {
    expect(resolveTrustSettings({ returnsWindowDays: '14' }).returnsWindowDays).toBeNull();
  });

  it('drops an empty or whitespace-only string', () => {
    expect(resolveTrustSettings({ packagingPromise: '   ' }).packagingPromise).toBeNull();
  });

  it('drops a negative returns window', () => {
    expect(resolveTrustSettings({ returnsWindowDays: -1 }).returnsWindowDays).toBeNull();
  });
});
