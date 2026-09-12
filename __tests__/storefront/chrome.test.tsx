import React from 'react';
import { render as rtlRender, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { FALLBACK_CHROME } from '@/lib/api/storefront';

// Header polls the resolved chrome through React Query, so it needs a client
// even when the nav items come in as props.
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

// jsdom does not implement ResizeObserver; Footer's body-padding measurement effect needs it.
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(global as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver =
  MockResizeObserver;

/**
 * The href of a link with this exact text INSIDE a nav landmark, or undefined.
 *
 * Scoped to <nav> because the Header also renders search suggestions that can
 * share a label with a nav item ("Perfume" -> /search?q=perfume); those are not
 * navigation and must not be what these assertions read.
 */
function navHref(label: string): string | undefined {
  return (
    Array.from(document.querySelectorAll('nav'))
      .flatMap((n) => Array.from(n.querySelectorAll('a')))
      .find((a) => a.textContent?.trim() === label)
      ?.getAttribute('href') ?? undefined
  );
}

describe('Header', () => {
  it('renders exactly the nav items it is given', () => {
    render(
      <Header
        navbar={{
          ...FALLBACK_CHROME.navbar,
          items: [
            { id: 'n1', label: 'Perfume', href: '/categories/perfume' },
            { id: 'n2', label: 'Atelier X', href: '/brands/atelier-x' },
          ],
        }}
      />,
    );
    // Scope to the nav landmark: the Header also renders search suggestions
    // that happen to share a label ("Perfume" -> /search?q=perfume), which are
    // not nav items and must not be what this test reads.
    const navs = Array.from(document.querySelectorAll('nav'));
    const navLinks = navs.flatMap((n) => Array.from(n.querySelectorAll('a')));
    const href = (label: string) =>
      navLinks.find((a) => a.textContent?.trim() === label)?.getAttribute('href');

    expect(href('Perfume')).toBe('/categories/perfume');
    expect(href('Atelier X')).toBe('/brands/atelier-x');
  });

  it('still offers Shop when the admin has listed no nav items', () => {
    /**
     * Shop is FIXED, not merchandising. A store that empties its nav by
     * accident still has a way back to its own catalogue — which is why this
     * test asserts its presence rather than an empty bar.
     */
    render(<Header navbar={FALLBACK_CHROME.navbar} />);

    expect(screen.getByRole('link', { name: /^Shop$/ })).toHaveAttribute('href', '/shop');
  });

  it('no longer pins Collab to the desktop bar (#59), and Shop is unaffected', () => {
    /**
     * Owner: "remove collab in desktop navbar and mobile navbar… but leave
     * shop". Collab is merchandising — a surface worth showing when there is
     * something in it — not the shop's structure, so it does not hold one of
     * very few permanent slots.
     *
     * This asserts the absence of the FIXED entry only. `/collab` and its
     * children still resolve (shared links have to keep working), and an admin
     * can still put it in the bar as an ordinary configured link — the case
     * immediately below.
     */
    render(<Header navbar={FALLBACK_CHROME.navbar} />);

    expect(navHref('Collab')).toBeUndefined();
    expect(navHref('Shop')).toBe('/shop');
  });

  it('an admin-configured Collab link still renders', () => {
    render(
      <Header
        navbar={{
          ...FALLBACK_CHROME.navbar,
          items: [{ id: 'collab', label: 'Collab', href: '/collab' }],
        }}
      />,
    );

    expect(navHref('Collab')).toBe('/collab');
  });
});

describe('Footer', () => {
  it('renders the configured columns and payment marks', () => {
    render(
      <Footer
        config={{
          ...FALLBACK_CHROME.footer,
          columns: [{ id: 'c1', title: 'Service', links: [{ id: 'l1', label: 'Contact', href: '/contact' }] }],
          paymentBadges: ['visa', 'instapay'],
          legalLine: '© MMXXVI',
        }}
      />,
    );
    expect(screen.getByText('Service')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact');
    expect(screen.getByLabelText('Visa')).toBeInTheDocument();
    expect(screen.getByLabelText('InstaPay')).toBeInTheDocument();
    expect(screen.queryByLabelText('Mastercard')).toBeNull();
  });
});
