/**
 * Unit tests — lib/analytics/tiktok-pixel.ts
 * Covers: trackTikTokEvent no-ops with mr-ads-off=1 and fires normally
 * without it; tiktokPixelBaseCode source-guards ttq load behind the same
 * cookie check (minirue-dashboard#111).
 */
import { trackTikTokEvent, tiktokPixelBaseCode } from '@/lib/analytics/tiktok-pixel';

function setCookie(value: string): void {
  document.cookie = value;
}

function clearCookies(): void {
  document.cookie.split(';').forEach((c) => {
    const name = c.split('=')[0]?.trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  });
}

describe('lib/analytics/tiktok-pixel', () => {
  const originalTtq = window.ttq;

  beforeEach(() => {
    clearCookies();
    window.ttq = { track: jest.fn() };
  });

  afterEach(() => {
    clearCookies();
    window.ttq = originalTtq;
  });

  it('calls ttq.track normally when mr-ads-off is not set', () => {
    trackTikTokEvent('ViewContent', { content_id: 'p1' }, 'evt-1');
    expect(window.ttq?.track).toHaveBeenCalledWith(
      'ViewContent',
      { content_id: 'p1' },
      { event_id: 'evt-1' },
    );
  });

  it('never calls ttq.track when mr-ads-off=1 is present', () => {
    setCookie('mr-ads-off=1');
    trackTikTokEvent('Purchase', { value: 10 }, 'evt-2');
    expect(window.ttq?.track).not.toHaveBeenCalled();
  });

  it('base code is wrapped in the ads-off cookie guard', () => {
    const code = tiktokPixelBaseCode('ABC123');
    expect(code.startsWith('if(!/')).toBe(true);
    expect(code).toContain('mr-ads-off=1');
    expect(code).toContain("ttq.load('ABC123')");
    expect(code.trim().endsWith('}')).toBe(true);
  });
});
