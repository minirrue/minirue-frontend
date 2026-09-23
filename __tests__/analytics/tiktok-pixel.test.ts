/**
 * Unit tests — lib/analytics/tiktok-pixel.ts
 * Covers: trackTikTokEvent no-ops with mr-ads-off=1 and fires normally
 * without it; tiktokPixelBaseCode source-guards ttq load behind the same
 * cookie check (minirue-dashboard#111).
 */
import { trackTikTokEvent, tiktokPixelBaseCode } from '@/lib/analytics/tiktok-pixel';
import React from 'react';
import { render } from '@testing-library/react';
import MetaPixel from '@/components/seo/MetaPixel';

let mockPathname = '/';
let mockSearchParams = '';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}));

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

describe('TikTok PageView on client navigation', () => {
  const originalTtq = window.ttq;
  const originalFbq = window.fbq;

  beforeEach(() => {
    clearCookies();
    mockPathname = '/';
    mockSearchParams = '';
    window.ttq = { page: jest.fn() };
    window.fbq = jest.fn();
  });

  afterEach(() => {
    clearCookies();
    window.ttq = originalTtq;
    window.fbq = originalFbq;
  });

  it('skips the initial PageView already sent by the base code, then tracks route and query changes once each', () => {
    const { rerender } = render(React.createElement(MetaPixel));
    expect(window.ttq?.page).not.toHaveBeenCalled();

    mockPathname = '/shop/skincare';
    rerender(React.createElement(MetaPixel));
    expect(window.ttq?.page).toHaveBeenCalledTimes(1);

    mockSearchParams = 'sort=price';
    rerender(React.createElement(MetaPixel));
    expect(window.ttq?.page).toHaveBeenCalledTimes(2);
  });

  it('does not send route-change PageViews on excluded devices', () => {
    const { rerender } = render(React.createElement(MetaPixel));
    setCookie('mr-ads-off=1');
    mockPathname = '/shop/skincare';
    rerender(React.createElement(MetaPixel));
    expect(window.ttq?.page).not.toHaveBeenCalled();
  });

  it('does not double-count initial load when React replays the mount effect', () => {
    render(React.createElement(React.StrictMode, null, React.createElement(MetaPixel)));
    expect(window.ttq?.page).not.toHaveBeenCalled();
  });
});
