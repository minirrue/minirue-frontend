import React from 'react';
import { render, screen, act } from '@testing-library/react';
import AnnouncementBar, { AnnouncementBarProvider } from '@/components/layout/AnnouncementBar';

/**
 * W3.7 — the dismissed state used to live in AnnouncementBar's own
 * useState. Every checkout step (and most storefront routes) is its own
 * route with no shared layout, so App Router unmounted and remounted the
 * bar per route and it reappeared each time it had just been collapsed.
 *
 * AnnouncementBarProvider lifts that boolean above the router (mounted
 * once in app/layout.tsx, same place CartProvider lives). This harness
 * mirrors that shape: the Provider stays mounted for the test like it does
 * in the root layout, while AnnouncementBar itself is added/removed like a
 * route-scoped child would be.
 */

/**
 * The bar needs a message to render at all.
 *
 * `AnnouncementBar` returns null when `messages.length === 0` — an unconfigured
 * bar shows nothing rather than an empty strip. This harness used to mount
 * `<AnnouncementBar />` with no props, so every test here failed on
 * "Unable to find a label with the text of: Announcements": it was asserting
 * dismiss and scroll-collapse behaviour against a component that had correctly
 * rendered nothing.
 */
const MESSAGES = ['Free shipping over 1500 EGP'];

function Harness({ showBar }: { showBar: boolean }) {
  return (
    <AnnouncementBarProvider>
      {showBar && <AnnouncementBar messages={MESSAGES} />}
    </AnnouncementBarProvider>
  );
}

describe('AnnouncementBar — hook order survives the bar being configured on and off', () => {
  /**
   * The early `return null` for an unconfigured bar used to sit ABOVE the
   * scroll-collapse useEffect, so the component called a different number of
   * hooks depending on whether the shop had any announcements. Toggling the bar
   * in the dashboard — or saving settings that emptied `messages` — changed the
   * hook count between renders and React tore the tree down with "Rendered
   * fewer hooks than expected".
   *
   * Rendering the same element with and then without messages is exactly that
   * transition.
   */
  it('re-renders from configured to empty and back without a hook-order error', () => {
    const { rerender } = render(
      <AnnouncementBarProvider>
        <AnnouncementBar messages={['Free shipping over 1500 EGP']} />
      </AnnouncementBarProvider>,
    );
    expect(screen.getByLabelText('Announcements')).toBeInTheDocument();

    // Admin clears the announcements.
    rerender(
      <AnnouncementBarProvider>
        <AnnouncementBar messages={[]} />
      </AnnouncementBarProvider>,
    );
    expect(screen.queryByLabelText('Announcements')).not.toBeInTheDocument();

    // And turns them back on.
    rerender(
      <AnnouncementBarProvider>
        <AnnouncementBar messages={['Back on']} />
      </AnnouncementBarProvider>,
    );
    expect(screen.getByLabelText('Announcements')).toBeInTheDocument();
  });

  it('survives the enabled flag being switched off and on', () => {
    const { rerender } = render(
      <AnnouncementBarProvider>
        <AnnouncementBar messages={['Free shipping']} enabled />
      </AnnouncementBarProvider>,
    );
    expect(screen.getByLabelText('Announcements')).toBeInTheDocument();

    rerender(
      <AnnouncementBarProvider>
        <AnnouncementBar messages={['Free shipping']} enabled={false} />
      </AnnouncementBarProvider>,
    );
    expect(screen.queryByLabelText('Announcements')).not.toBeInTheDocument();

    rerender(
      <AnnouncementBarProvider>
        <AnnouncementBar messages={['Free shipping']} enabled />
      </AnnouncementBarProvider>,
    );
    expect(screen.getByLabelText('Announcements')).toBeInTheDocument();
  });
});

function collapseBar() {
  act(() => {
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 10, cancelable: true }));
  });
}

function barHeightPx(): string {
  return screen.getByLabelText('Announcements').style.height;
}

describe('AnnouncementBar dismissed state (W3.7)', () => {
  it('starts visible', () => {
    render(<Harness showBar />);
    expect(barHeightPx()).not.toBe('0px');
  });

  it('collapses on the first downward scroll gesture', () => {
    render(<Harness showBar />);
    collapseBar();
    expect(barHeightPx()).toBe('0px');
  });

  it('stays hidden across a simulated route change (provider persists, bar remounts)', () => {
    const { rerender } = render(<Harness showBar />);
    collapseBar();
    expect(barHeightPx()).toBe('0px');

    // Simulated route change: the bar unmounts (new route, no shared layout)...
    rerender(<Harness showBar={false} />);
    expect(screen.queryByLabelText('Announcements')).toBeNull();

    // ...and remounts on the next step. The Provider instance above it never
    // unmounted, so the collapsed state carries over instead of resetting.
    rerender(<Harness showBar />);
    expect(barHeightPx()).toBe('0px');
  });

  it('resets on remount of the provider (a real refresh)', () => {
    const { unmount } = render(<Harness showBar />);
    collapseBar();
    expect(barHeightPx()).toBe('0px');

    // A real page refresh tears down the whole React tree, provider
    // included, and rebuilds it from scratch.
    unmount();
    render(<Harness showBar />);
    expect(barHeightPx()).not.toBe('0px');
  });
});
