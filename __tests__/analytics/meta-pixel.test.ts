/**
 * Unit tests — lib/analytics/meta-pixel.ts
 * Covers: trackMetaPixelEvent no-ops with mr-ads-off=1 and fires normally
 * without it; metaPixelBaseCode source-guards fbq init behind the same
 * cookie check (minirue-dashboard#111).
 */
import { trackMetaPixelEvent, metaPixelBaseCode } from '@/lib/analytics/meta-pixel';

function setCookie(value: string): void {
  document.cookie = value;
}

function clearCookies(): void {
  // jsdom has no cookie-jar reset API; expire everything this suite may set.
  document.cookie.split(';').forEach((c) => {
    const name = c.split('=')[0]?.trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  });
}

describe('lib/analytics/meta-pixel', () => {
  const originalFbq = window.fbq;

  beforeEach(() => {
    clearCookies();
    window.fbq = jest.fn();
  });

  afterEach(() => {
    clearCookies();
    window.fbq = originalFbq;
  });

  it('calls fbq normally when mr-ads-off is not set', () => {
    trackMetaPixelEvent('ViewContent', { content_ids: ['p1'] }, 'evt-1');
    expect(window.fbq).toHaveBeenCalledWith(
      'track',
      'ViewContent',
      { content_ids: ['p1'] },
      { eventID: 'evt-1' },
    );
  });

  it('never calls fbq when mr-ads-off=1 is present', () => {
    setCookie('mr-ads-off=1');
    trackMetaPixelEvent('Purchase', { value: 10 }, 'evt-2');
    expect(window.fbq).not.toHaveBeenCalled();
  });

  it('still no-ops beside other cookies', () => {
    setCookie('mr-vid=abc');
    setCookie('mr-ads-off=1');
    setCookie('mr-attr-pub=xyz');
    trackMetaPixelEvent('AddToCart', {}, 'evt-3');
    expect(window.fbq).not.toHaveBeenCalled();
  });

  it('base code is wrapped in the ads-off cookie guard', () => {
    const code = metaPixelBaseCode('123456');
    expect(code.startsWith('if(!/')).toBe(true);
    expect(code).toContain('mr-ads-off=1');
    expect(code).toContain("fbq('init', '123456')");
    // The guard must wrap the whole init/loader, not just decorate it —
    // the closing brace after the PageView call is what actually skips
    // window.fbq ever being defined.
    expect(code.trim().endsWith('}')).toBe(true);
  });
});
