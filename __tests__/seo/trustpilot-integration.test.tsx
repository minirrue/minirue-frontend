import { render } from '@testing-library/react';
import TrustpilotIntegration, {
  shouldLoadTrustpilot,
} from '@/components/seo/TrustpilotIntegration';

let pathname = '/';

jest.mock('next/navigation', () => ({
  usePathname: () => pathname,
}));

jest.mock('next/script', () => ({
  __esModule: true,
  default: (props: React.ComponentProps<'script'>) => <script {...props} />,
}));

describe('Trustpilot integration', () => {
  it('loads after interaction on storefront pages and only registers the domain', () => {
    pathname = '/shop/all';
    const { container } = render(<TrustpilotIntegration />);
    const script = container.querySelector('#minirue-trustpilot-integration');

    expect(script).not.toBeNull();
    expect(script?.textContent).toContain('invitejs.trustpilot.com/tp.min.js');
    expect(script?.textContent).toContain("window.tp('register'");
    expect(script?.textContent).not.toContain('createInvitation');
  });

  it('does not load anywhere in checkout', () => {
    expect(shouldLoadTrustpilot('/checkout')).toBe(false);
    expect(shouldLoadTrustpilot('/checkout/confirmation')).toBe(false);
    pathname = '/checkout/confirmation';
    const { container } = render(<TrustpilotIntegration />);

    expect(container).toBeEmptyDOMElement();
  });
});
