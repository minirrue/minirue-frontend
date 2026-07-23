import { render, screen } from '@testing-library/react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { FALLBACK_CHROME } from '@/lib/api/storefront';

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
    expect(screen.getByRole('link', { name: 'Perfume' })).toHaveAttribute('href', '/categories/perfume');
    expect(screen.getByRole('link', { name: 'Atelier X' })).toHaveAttribute('href', '/brands/atelier-x');
  });

  it('renders no nav links when the admin listed none', () => {
    const { container } = render(<Header navbar={FALLBACK_CHROME.navbar} />);
    expect(container.querySelector('nav a')).toBeNull();
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
