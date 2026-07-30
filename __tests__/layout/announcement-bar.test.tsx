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

function Harness({ showBar }: { showBar: boolean }) {
  return <AnnouncementBarProvider>{showBar && <AnnouncementBar />}</AnnouncementBarProvider>;
}

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
