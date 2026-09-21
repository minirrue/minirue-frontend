import React from 'react';
import { render as rtlRender, screen, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import {
  FALLBACK_CHROME,
  ESSENTIAL_PAGE_LINKS,
  missingEssentialPageLinks,
} from '@/lib/api/storefront';
import { openMobileMenu, __resetMobileChromeForTests } from '@/lib/hooks/useMobileChrome';

/**
 * The mobile menu is the desktop navbar, and the trust pages are reachable.
 * =========================================================================
 *
 * Two separate faults, verified against production on 2026-09-21, with one
 * shared root: nothing merges the shop's OWN structural links into whatever
 * config the backend happens to return.
 *
 *   1. `GET /v1/storefront/chrome` answers with `navbar.items: []`. The
 *      desktop bar rendered its fixed "Shop" link on top of that and looked
 *      fine; `MobileNavSheet` was handed the raw `navbar` and rendered
 *      "No menu items yet." Two lists, agreeing only by coincidence — and on
 *      the live shop, not agreeing at all.
 *
 *   2. `/shipping`, `/returns`, `/contact` and `/about` all answer 200 and a
 *      grep across `app/`, `components/` and `lib/` for any of them returned
 *      ZERO hits. They existed and nothing linked to them.
 *
 * `/terms` and `/privacy` are deliberately absent from both the header and the
 * footer: they 404 today, and the chrome payload carries no published/missing
 * signal to hide a dead one with. The last test here pins that, so whoever
 * authors those pages finds the one place to add them.
 *
 * Note what is NOT asserted here: anything about `FALLBACK_CHROME`. It stays
 * empty — `storefront-client.test.ts` still pins it — because it renders only
 * when the API is unreachable, and these pages are served by `app/[slug]` from
 * that same API. The merge happens in the components, against whichever config
 * actually resolved, which is why every test below drives real config rather
 * than the fallback.
 */

function render(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return rtlRender(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

jest.mock('@/lib/hooks/use-auth', () => ({
  useUser: () => ({ data: null }),
  useLogout: () => ({ mutate: jest.fn(), isPending: false }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(global as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver =
  MockResizeObserver;

function setWidth(w: number) {
  Object.defineProperty(window, 'innerWidth', { value: w, writable: true, configurable: true });
}

/** Labels of the desktop bar's own links, in order. */
function desktopNavLabels(): string[] {
  return Array.from(document.querySelectorAll('header nav a')).map((a) =>
    (a.textContent ?? '').trim(),
  );
}

function desktopNavHref(label: string): string | undefined {
  return (
    Array.from(document.querySelectorAll('header nav a'))
      .find((a) => (a.textContent ?? '').trim() === label)
      ?.getAttribute('href') ?? undefined
  );
}

/**
 * Labels of the mobile sheet's own nav rows, in order. Both element kinds are
 * collected — a row is a `<button>` when the item drills into subcategories
 * and an `<a>` when it does not — because the mirror is about the LIST, not
 * about which rows happen to open a panel.
 */
function mobileNavLabels(): string[] {
  return Array.from(
    document.querySelectorAll(
      '[data-trace-id^="PG-STOREFRONT-NAV-001::EL-LINK-mobile-nav-item@"],' +
        '[data-trace-id^="PG-STOREFRONT-NAV-001::EL-BTN-mobile-nav-drill@"]',
    ),
  ).map((el) => (el.textContent ?? '').trim());
}

/** Renders the Header at phone width with the menu open, sheet loaded. */
async function renderMobileMenu(navbar: typeof FALLBACK_CHROME.navbar) {
  setWidth(390);
  const view = render(<Header navbar={navbar} />);
  act(() => {
    openMobileMenu();
  });
  await waitFor(() => {
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeInTheDocument();
  });
  return view;
}

beforeEach(() => {
  __resetMobileChromeForTests();
});

afterEach(() => {
  __resetMobileChromeForTests();
  setWidth(1024);
});

const LIVE_EMPTY_NAVBAR = { items: [], showSearch: true, showAccount: true };

const CURATED_NAVBAR = {
  items: [
    { id: 'n1', label: 'Perfume', href: '/shop/perfume' },
    { id: 'n2', label: 'Haircare', href: '/shop/haircare' },
  ],
  showSearch: true,
  showAccount: true,
};

describe('the mobile menu mirrors the desktop navbar', () => {
  it('shows the same links, in the same order, when the admin configured none', async () => {
    setWidth(1440);
    const desktop = render(<Header navbar={LIVE_EMPTY_NAVBAR} />);
    await waitFor(() => expect(desktopNavLabels().length).toBeGreaterThan(0));
    const onDesktop = desktopNavLabels();
    desktop.unmount();

    await renderMobileMenu(LIVE_EMPTY_NAVBAR);

    // The exact failure this closes: on the live shop the desktop bar said
    // "Shop" and the sheet said "No menu items yet."
    expect(screen.queryByText('No menu items yet.')).toBeNull();
    expect(mobileNavLabels()).toEqual(onDesktop);
  });

  it('shows the same links when the admin HAS configured some', async () => {
    setWidth(1440);
    const desktop = render(<Header navbar={CURATED_NAVBAR} />);
    await waitFor(() => expect(desktopNavLabels().length).toBeGreaterThan(0));
    const onDesktop = desktopNavLabels();
    desktop.unmount();

    await renderMobileMenu(CURATED_NAVBAR);

    expect(mobileNavLabels()).toEqual(onDesktop);
    // And the admin's own items really are in that shared list.
    expect(onDesktop).toEqual(expect.arrayContaining(['Perfume', 'Haircare']));
  });
});

describe('the trust pages are reachable from the header', () => {
  it('lists Shipping, Returns, Contact and About beside Shop', async () => {
    setWidth(1440);
    render(<Header navbar={LIVE_EMPTY_NAVBAR} />);
    await waitFor(() => expect(desktopNavLabels().length).toBeGreaterThan(0));

    expect(desktopNavHref('Shop')).toBe('/shop');
    for (const link of ESSENTIAL_PAGE_LINKS) {
      expect(desktopNavHref(link.label)).toBe(link.href);
    }
  });

  it('leaves an admin-configured trust link alone instead of listing it twice', async () => {
    setWidth(1440);
    render(
      <Header
        navbar={{
          items: [{ id: 'own', label: 'Reach us', href: '/contact' }],
          showSearch: true,
          showAccount: true,
        }}
      />,
    );
    await waitFor(() => expect(desktopNavLabels().length).toBeGreaterThan(0));

    const labels = desktopNavLabels();
    // The admin's label and position survive; ours is dropped, not appended.
    expect(labels).toContain('Reach us');
    expect(labels).not.toContain('Contact');
    expect(labels.filter((l) => desktopNavHref(l) === '/contact')).toHaveLength(1);
  });

  it('never links /terms or /privacy, which 404 today', async () => {
    setWidth(1440);
    render(<Header navbar={LIVE_EMPTY_NAVBAR} />);
    await waitFor(() => expect(desktopNavLabels().length).toBeGreaterThan(0));

    const hrefs = Array.from(document.querySelectorAll('header a')).map((a) =>
      a.getAttribute('href'),
    );
    expect(hrefs).not.toContain('/terms');
    expect(hrefs).not.toContain('/privacy');
  });
});

describe('the footer links the pages that exist', () => {
  /** The live footer as production returns it: one auth-gated link. */
  const LIVE_FOOTER = {
    ...FALLBACK_CHROME.footer,
    columns: [
      {
        id: 'col-service',
        title: 'Service',
        links: [{ id: 'l-track', label: 'Track order', href: '/account/orders' }],
      },
    ],
  };

  function footerHref(label: string): string | undefined {
    return (
      Array.from(document.querySelectorAll('footer a'))
        .find((a) => (a.textContent ?? '').trim() === label)
        ?.getAttribute('href') ?? undefined
    );
  }

  it('adds Shipping, Returns, Contact and About to the live one-link footer', () => {
    render(<Footer config={LIVE_FOOTER} />);

    for (const link of ESSENTIAL_PAGE_LINKS) {
      expect(footerHref(link.label)).toBe(link.href);
    }
  });

  it("keeps the admin's own column and link untouched", () => {
    render(<Footer config={LIVE_FOOTER} />);

    // "Track order" is the admin's to keep or remove — a guest-hostile link is
    // an owner-side content decision, not something the storefront deletes.
    expect(screen.getByText('Service')).toBeInTheDocument();
    expect(footerHref('Track order')).toBe('/account/orders');
  });

  it('adds nothing at all once every essential page is configured', () => {
    render(
      <Footer
        config={{
          ...FALLBACK_CHROME.footer,
          columns: [
            {
              id: 'c1',
              title: 'Help',
              links: ESSENTIAL_PAGE_LINKS.map((l) => ({
                id: l.id,
                // A different label and a trailing slash — still the same page.
                label: `${l.label} & more`,
                href: `${l.href}/`,
              })),
            },
          ],
        }}
      />,
    );

    const columnTitles = Array.from(document.querySelectorAll('[data-testid="footer-columns"] > div'));
    expect(columnTitles).toHaveLength(1);
  });

  it('never links /terms or /privacy either', () => {
    render(<Footer config={LIVE_FOOTER} />);
    const hrefs = Array.from(document.querySelectorAll('footer a')).map((a) =>
      a.getAttribute('href'),
    );
    expect(hrefs).not.toContain('/terms');
    expect(hrefs).not.toContain('/privacy');
  });
});

describe('missingEssentialPageLinks', () => {
  it('returns every essential link when nothing is configured', () => {
    expect(missingEssentialPageLinks([])).toEqual([...ESSENTIAL_PAGE_LINKS]);
  });

  it('matches regardless of case or a trailing slash', () => {
    expect(missingEssentialPageLinks(['/Shipping/', '/RETURNS', '/contact/', '/about'])).toEqual([]);
  });

  it('lists only the pages that exist — never /terms or /privacy', () => {
    expect(ESSENTIAL_PAGE_LINKS.map((l) => l.href)).toEqual([
      '/shipping',
      '/returns',
      '/contact',
      '/about',
    ]);
  });
});
