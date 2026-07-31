import { act, render, screen, waitFor } from '@testing-library/react';
import PageLoader from '@/components/layout/PageLoader';
import { __resetHistoryPatchForTests } from '@/lib/navigation/usePageNavigationLoading';

/**
 * Task 43 (2026-07-31), owner clarification: "here its between pages only
 * navigation back or forth". This suite proves both halves explicitly
 * called out as easy to miss:
 *  - the show-delay (no flash for a navigation fast enough to resolve
 *    inside the delay window), and
 *  - that a browser BACK navigation shows the loader too, not only a
 *    forward `<Link>` click — the failure mode `useLinkStatus` alone would
 *    have produced.
 *
 * `usePathname` is mocked so the test controls exactly when the route is
 * considered "committed". A real Back/Forward navigation updates
 * `window.location` BEFORE `popstate` fires and WITHOUT going through
 * `history.pushState`/`replaceState` — reproduced here via
 * `History.prototype.pushState.call(...)`, which bypasses this module's
 * patched instance method exactly the way a real back-navigation does.
 */
let mockPathname = '/products/starter-bottle';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

function goToUrlWithoutNotifying(path: string) {
  // Bypasses usePageNavigationLoading's patched history.pushState — a real
  // Back/Forward/swipe-back never calls pushState/replaceState at all; the
  // browser already owns that history entry and only fires `popstate`.
  History.prototype.pushState.call(window.history, {}, '', path);
}

describe('PageLoader', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockPathname = '/products/starter-bottle';
    __resetHistoryPatchForTests();
    window.history.replaceState({}, '', '/products/starter-bottle');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders nothing before the delay elapses', () => {
    render(<PageLoader delayMs={200} />);

    act(() => {
      window.history.pushState({}, '', '/products/other-bottle');
    });
    expect(screen.queryByTestId('page-loader')).not.toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(150);
    });
    expect(screen.queryByTestId('page-loader')).not.toBeInTheDocument();
  });

  it('appears once the delay elapses for a forward navigation (Link/router.push)', async () => {
    render(<PageLoader delayMs={200} />);

    act(() => {
      window.history.pushState({}, '', '/products/other-bottle');
    });
    act(() => {
      jest.advanceTimersByTime(200);
    });
    await waitFor(() => {
      expect(screen.getByTestId('page-loader')).toBeInTheDocument();
    });
  });

  it('never flashes for a fast navigation that commits inside the delay window', () => {
    const { rerender } = render(<PageLoader delayMs={200} />);

    act(() => {
      window.history.pushState({}, '', '/products/other-bottle');
    });
    // Route commits well before the show-delay elapses.
    act(() => {
      jest.advanceTimersByTime(80);
    });
    mockPathname = '/products/other-bottle';
    rerender(<PageLoader delayMs={200} />);

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.queryByTestId('page-loader')).not.toBeInTheDocument();
  });

  it('appears for a BACK navigation, not only a forward Link click', async () => {
    render(<PageLoader delayMs={200} />);

    // Simulate the browser Back button: the URL changes and `popstate`
    // fires WITHOUT any pushState/replaceState call — exactly what
    // `history.pushState`-patching alone (or `useLinkStatus`) would miss.
    act(() => {
      goToUrlWithoutNotifying('/products/other-bottle');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    act(() => {
      jest.advanceTimersByTime(200);
    });

    await waitFor(() => {
      expect(screen.getByTestId('page-loader')).toBeInTheDocument();
    });
  });

  it('fades out and unmounts once the route commits, and does not show twice for one navigation', async () => {
    const { rerender } = render(<PageLoader delayMs={0} />);

    act(() => {
      window.history.pushState({}, '', '/products/other-bottle');
      jest.advanceTimersByTime(0);
    });
    await waitFor(() => {
      expect(screen.getByTestId('page-loader')).toHaveStyle({ opacity: 1 });
    });

    // Route commits — the overlay must fade out, not vanish or re-show.
    mockPathname = '/products/other-bottle';
    rerender(<PageLoader delayMs={0} />);
    expect(screen.getByTestId('page-loader')).toHaveStyle({ opacity: 0 });

    act(() => {
      jest.advanceTimersByTime(250);
    });
    expect(screen.queryByTestId('page-loader')).not.toBeInTheDocument();
  });

  it('has an accessible, polite live region once shown', async () => {
    render(<PageLoader delayMs={0} />);
    act(() => {
      window.history.pushState({}, '', '/products/other-bottle');
      jest.advanceTimersByTime(0);
    });
    await waitFor(() => {
      expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    });
  });
});
