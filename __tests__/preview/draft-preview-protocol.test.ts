/**
 * The draft preview's gatekeeping (#193): which origins may frame it and talk
 * to it, and which messages it will render. The dashboard is coded against
 * these exact strings, so the tests pin them.
 */
import {
  DEFAULT_DASHBOARD_ORIGINS,
  DRAFT_PREVIEW_PATH,
  parseDashboardOrigins,
} from '@/lib/preview/dashboard-origins';
import {
  PREVIEW_HEIGHT,
  PREVIEW_MODE,
  PREVIEW_NAVIGATE,
  PREVIEW_READY,
  PREVIEW_RENDER,
  PREVIEW_SELECT,
  isAllowedOrigin,
  parseModeMessage,
  parseRenderMessage,
} from '@/lib/preview/protocol';

const home = { sections: [], announcement: { enabled: false, messages: [], linkUrl: null, background: null } };
const chrome = {
  announcement: { enabled: true, messages: ['DRAFT'], linkUrl: null, background: null },
  productSection: { perks: [] },
  faviconUrl: null,
  shopName: 'MiniRue',
  shopLogoUrl: null,
  navbar: { items: [], showSearch: true, showAccount: true },
  mobileMenu: { shortcuts: [], footerButton: null },
  footer: { columns: [], socials: [] },
};

describe('draft preview protocol strings', () => {
  it('are exactly the contract the dashboard codes against', () => {
    expect(DRAFT_PREVIEW_PATH).toBe('/_internal/draft-preview');
    expect([PREVIEW_READY, PREVIEW_HEIGHT, PREVIEW_SELECT, PREVIEW_RENDER]).toEqual([
      'mr-preview:ready',
      'mr-preview:height',
      'mr-preview:select',
      'mr-preview:render',
    ]);
  });
});

describe('parseDashboardOrigins', () => {
  it('always includes the dashboard and its dev server', () => {
    expect(parseDashboardOrigins(undefined)).toEqual([
      'https://dashboard.minirueshop.com',
      'http://localhost:3021',
    ]);
    expect(DEFAULT_DASHBOARD_ORIGINS).toHaveLength(2);
  });

  it('adds comma-separated extra origins, trimmed, without duplicates', () => {
    expect(
      parseDashboardOrigins(' https://staging.example.com , http://localhost:3021,https://staging.example.com/'),
    ).toEqual([
      'https://dashboard.minirueshop.com',
      'http://localhost:3021',
      'https://staging.example.com',
    ]);
  });

  it('drops anything that is not a bare http(s) origin, so nothing can be injected into the CSP', () => {
    expect(
      parseDashboardOrigins(
        "https://x.test; script-src *,https://y.test/path,javascript:alert(1),*,'self',ftp://z.test",
      ),
    ).toEqual(['https://dashboard.minirueshop.com', 'http://localhost:3021']);
  });
});

describe('isAllowedOrigin', () => {
  const allowed = parseDashboardOrigins(undefined);

  it('accepts the dashboard', () => {
    expect(isAllowedOrigin('https://dashboard.minirueshop.com', allowed)).toBe(true);
  });

  it('refuses look-alikes: exact match only', () => {
    for (const origin of [
      'https://dashboard.minirueshop.com.evil.test',
      'https://evil-dashboard.minirueshop.com',
      'http://dashboard.minirueshop.com',
      'https://minirueshop.com',
      'null',
      '',
    ]) {
      expect(isAllowedOrigin(origin, allowed)).toBe(false);
    }
  });
});

describe('parseRenderMessage', () => {
  it('accepts a home render', () => {
    const msg = parseRenderMessage({ type: 'mr-preview:render', home, chrome, view: 'home', highlight: 'hero-1' });
    expect(msg).toMatchObject({ view: 'home', highlight: 'hero-1' });
    expect(msg?.chrome.announcement.messages).toEqual(['DRAFT']);
  });

  it('accepts page and product renders carrying what they need', () => {
    expect(
      parseRenderMessage({
        type: 'mr-preview:render',
        home,
        chrome,
        view: 'page',
        page: { slug: 'terms', title: 'Terms', body: '# Hi' },
      })?.page,
    ).toEqual({ slug: 'terms', title: 'Terms', body: '# Hi' });
    expect(
      parseRenderMessage({ type: 'mr-preview:render', home, chrome, view: 'product', productSlug: 'oud' })
        ?.productSlug,
    ).toBe('oud');
  });

  it('ignores anything else', () => {
    const bad: unknown[] = [
      null,
      'mr-preview:render',
      { type: 'mr-preview:ready' },
      { type: 'mr-preview:render', home: {}, chrome, view: 'home' },
      { type: 'mr-preview:render', home, chrome: { ...chrome, navbar: undefined }, view: 'home' },
      { type: 'mr-preview:render', home, chrome, view: 'checkout' },
      { type: 'mr-preview:render', home, chrome, view: 'page' },
      { type: 'mr-preview:render', home, chrome, view: 'product' },
      { type: 'mr-preview:render', home, chrome, view: 'home', highlight: 7 },
    ];
    for (const data of bad) expect(parseRenderMessage(data)).toBeNull();
  });
});

describe('Interact mode messages (#196)', () => {
  it('pins the exact strings the dashboard sends and reads', () => {
    expect(PREVIEW_MODE).toBe('mr-preview:mode');
    expect(PREVIEW_NAVIGATE).toBe('mr-preview:navigate');
  });

  it('accepts a boolean mode and nothing else', () => {
    expect(parseModeMessage({ type: 'mr-preview:mode', interactive: true })).toEqual({ interactive: true });
    expect(parseModeMessage({ type: 'mr-preview:mode', interactive: false })).toEqual({ interactive: false });
    for (const data of [
      null,
      'mr-preview:mode',
      { type: 'mr-preview:mode' },
      { type: 'mr-preview:mode', interactive: 'yes' },
      { type: 'mr-preview:render', interactive: true },
    ]) {
      expect(parseModeMessage(data)).toBeNull();
    }
  });
});
