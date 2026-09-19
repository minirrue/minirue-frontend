/**
 * Unit tests — lib/analytics/ads-off.ts
 */
import { isAdsOff, ADS_OFF_INLINE_CHECK } from '@/lib/analytics/ads-off';

function setCookie(value: string): void {
  document.cookie = value;
}

function clearCookies(): void {
  document.cookie.split(';').forEach((c) => {
    const name = c.split('=')[0]?.trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  });
}

describe('lib/analytics/ads-off', () => {
  beforeEach(clearCookies);
  afterEach(clearCookies);

  it('is false with no cookies at all', () => {
    expect(isAdsOff()).toBe(false);
  });

  it('is false when other cookies are set but not mr-ads-off', () => {
    setCookie('mr-vid=abc');
    expect(isAdsOff()).toBe(false);
  });

  it('is true when mr-ads-off=1 is present alone', () => {
    setCookie('mr-ads-off=1');
    expect(isAdsOff()).toBe(true);
  });

  it('is true when mr-ads-off=1 is present among other cookies', () => {
    setCookie('mr-vid=abc');
    setCookie('mr-ads-off=1');
    setCookie('mr-attr-pub=xyz');
    expect(isAdsOff()).toBe(true);
  });

  it('the inline check fragment is syntactically valid JS that agrees with isAdsOff', () => {
    // Evaluating our own generated source fragment exactly as the inline
    // <script> in app/layout.tsx does.
    const evaluate = new Function(`return ${ADS_OFF_INLINE_CHECK};`);

    expect(evaluate()).toBe(!isAdsOff());

    setCookie('mr-ads-off=1');
    expect(evaluate()).toBe(!isAdsOff());
  });
});
