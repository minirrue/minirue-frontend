'use client';

/**
 * MobileBottomNav — phone/tablet tab bar (W4a.2).
 *
 * New: nothing like it existed (a repo-wide grep for `bottom.?nav|BottomBar|
 * TabBar` returned nothing before this). On mobile the top bar holds the
 * hamburger, logo, search and bag; account was only reachable inside the
 * hamburger sheet. This surfaces Home / Menu / Search / Shop / Cart / Account
 * as a persistent bottom tab bar below 1024px, mirroring the top bar's
 * show/hide so exactly one bar owns the edge the shopper is scrolling toward.
 *
 * Mounted once in `app/layout.tsx` (same tier as `CartDrawer`/`SupportWidget`)
 * rather than per-page, so it exists even on routes that render their own
 * `Header` instance independently (home, checkout, account…). "Menu" and
 * "Search" open the SAME `MobileNavSheet`/`SearchSheet` the top bar's
 * hamburger and search icon open — via the shared `useMobileChrome` store,
 * since this component is never an ancestor or descendant of whichever
 * `Header` the current route mounted. "Cart" reuses the existing global
 * `CartContext`/`CartDrawer`, no new store needed.
 */

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { useBreakpoint } from '@/lib/hooks/useBreakpoint';
import { useScrollDirection } from '@/lib/hooks/useScrollDirection';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';
import { openMobileMenu, openMobileSearch } from '@/lib/hooks/useMobileChrome';
import { useCart } from '@/components/storefront/cart/CartContext';
import { getSession, type Session } from '@/lib/session';

const BAR_HEIGHT = 58;

/**
 * Bug 1 (task-storefront-bugs): the PDP sticky buy bar needs to sit directly
 * on top of this nav rather than being covered by it. A hardcoded pixel
 * guess in ApiProductDetail.tsx would drift the moment this bar's real
 * on-screen height changes (safe-area inset, a border tweak, a future
 * redesign) — so instead this component measures its OWN rendered box and
 * publishes the result as a CSS custom property on `document.documentElement`.
 * Global, not local: this nav is mounted once in `app/layout.tsx` and the buy
 * bar lives in an unrelated subtree (ApiProductDetail.tsx), so there is no
 * shared ancestor to scope the property to.
 */
const BOTTOM_NAV_OFFSET_VAR = '--mr-bottom-nav-offset';

interface NavItem {
  key: string;
  label: string;
  icon: Parameters<typeof Icon>[0]['name'];
}

const ITEMS: NavItem[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'menu', label: 'Menu', icon: 'menu' },
  { key: 'search', label: 'Search', icon: 'search' },
  { key: 'shop', label: 'Shop', icon: 'grid' },
  { key: 'cart', label: 'Cart', icon: 'bag' },
  { key: 'account', label: 'Account', icon: 'user' },
];

export default function MobileBottomNav() {
  const { tablet, w } = useBreakpoint();
  const { direction, atTop, atBottom } = useScrollDirection();
  const reducedMotion = usePrefersReducedMotion();
  const { itemCount, openDrawer } = useCart();
  const pathname = usePathname();

  const [session, setSession] = React.useState<Session | null>(null);
  React.useEffect(() => {
    setSession(getSession());
  }, [pathname]);

  // `w` starts at 0 server-side (useBreakpoint measures after mount), so
  // `tablet` (w < 1024) is false on the very first client render too —
  // exactly the state desktop is in. Gating on `w > 0` as well stops the bar
  // flashing in on a desktop viewport for one frame before hydration
  // corrects it, without waiting an extra tick on phones (their first
  // measured `w` is already < 1024).
  const measured = w > 0;
  const belowBreakpoint = measured && tablet;

  // Same rule as the top bar, mirrored: near the top, the top bar wins and
  // this stays hidden; once the page has scrolled down, this bar takes the
  // edge back on the next downward scroll and the top bar cedes it.
  //
  // Task 15a: also hidden at `atBottom`. Reaching the very end of a page IS a
  // downward scroll, so a bar gated only on `direction === 'down'` was most
  // visible exactly where it covers the footer. `atBottom` only fires within
  // a couple px of the true end, so this never hides the bar "near" the
  // bottom, only at it.
  const visible = belowBreakpoint && !atTop && !atBottom && direction === 'down';

  const accountHref = session ? '/account/profile' : '/login';

  const navRef = React.useRef<HTMLElement | null>(null);

  // Publish this bar's real rendered height (0 while it's translated off
  // screen) so the PDP buy bar can stack directly above it instead of being
  // covered by it. Measured via ResizeObserver against the actual box —
  // not `BAR_HEIGHT` alone — because the rendered height also folds in the
  // safe-area-inset-bottom padding and the hairline border, which this
  // component doesn't otherwise expose a single source of truth for.
  React.useEffect(() => {
    const el = navRef.current;
    if (!el || typeof window === 'undefined') return;

    const apply = () => {
      const height = visible ? el.getBoundingClientRect().height : 0;
      document.documentElement.style.setProperty(BOTTOM_NAV_OFFSET_VAR, `${height}px`);
    };
    apply();

    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [visible]);

  // This component is mounted once, for the app's whole lifetime — but if
  // that ever changes, never leave a stale offset stacked under whatever
  // reads this property next.
  React.useEffect(() => {
    return () => {
      document.documentElement.style.setProperty(BOTTOM_NAV_OFFSET_VAR, '0px');
    };
  }, []);

  return (
    <nav
      ref={navRef}
      aria-label="Primary"
      data-testid="mobile-bottom-nav"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        // Stacking, not z-fighting: the PDP sticky buy bar reads
        // `--mr-bottom-nav-offset` (set above) and sits its own `bottom` at
        // that value, so the two are vertically adjacent — buy bar directly
        // above this nav — and never overlap in either direction. This bar's
        // own z-index only has to clear ordinary page content.
        zIndex: 20,
        display: belowBreakpoint ? 'flex' : 'none',
        height: BAR_HEIGHT,
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'rgba(246,242,233,0.96)',
        // Dropped entirely when hidden. A backdrop-filter of any value keeps
        // its own compositing layer alive, sampling whatever is behind it.
        backdropFilter: visible ? 'blur(18px)' : 'none',
        WebkitBackdropFilter: visible ? 'blur(18px)' : 'none',
        borderTop: '1px solid var(--mr-hairline)',
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        // A hidden bar is HIDDEN, not merely parked below the fold.
        //
        // translateY(100%) leaves a full-width cream bar sitting immediately
        // under the viewport. Nothing on the page scrolls it into view — but
        // an overscroll does: drag past the end of the page on a touch device
        // and the rubber-band reveals what is below, which is this. It springs
        // back the instant the finger lifts, which is what identified it as
        // overscroll rather than a stuck element.
        //
        // This is the "weird bottom sheet" reported through three rounds of
        // QC. It read as a rounded panel because a phone's DISPLAY corners are
        // rounded — the bar itself has no border-radius at all, which is
        // exactly why searching the CSS for one kept finding the wrong things.
        //
        // Delayed by the slide duration when hiding so the bar is still
        // painted while it animates out; instant when showing.
        visibility: visible ? 'visible' : 'hidden',
        transition: reducedMotion
          ? 'none'
          : `transform 280ms var(--mr-ease-out), visibility 0s linear ${visible ? 0 : 280}ms`,
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      {ITEMS.map((item) => {
        const badge = item.key === 'cart' ? itemCount : undefined;
        const content = (
          <>
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <Icon name={item.icon} size={20} />
              {(badge ?? 0) > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -8,
                    minWidth: 15,
                    height: 15,
                    padding: '0 4px',
                    borderRadius: 999,
                    background: 'var(--mr-crimson-700)',
                    color: 'var(--mr-cream-100)',
                    fontFamily: 'Jost, sans-serif',
                    fontSize: 9,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {badge}
                </span>
              )}
            </span>
            <span
              style={{
                fontFamily: 'Jost, sans-serif',
                fontSize: 9,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--mr-ink-700)',
              }}
            >
              {item.label}
            </span>
          </>
        );

        const itemStyle: React.CSSProperties = {
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          height: '100%',
          background: 'transparent',
          border: 0,
          color: 'var(--mr-ink-700)',
          textDecoration: 'none',
          cursor: 'pointer',
        };

        if (item.key === 'menu') {
          return (
            <button
              key={item.key}
              type="button"
              aria-label="Menu"
              tabIndex={visible ? 0 : -1}
              onClick={openMobileMenu}
              style={itemStyle}
            >
              {content}
            </button>
          );
        }
        if (item.key === 'search') {
          return (
            <button
              key={item.key}
              type="button"
              aria-label="Search"
              tabIndex={visible ? 0 : -1}
              onClick={openMobileSearch}
              style={itemStyle}
            >
              {content}
            </button>
          );
        }
        if (item.key === 'cart') {
          return (
            <button
              key={item.key}
              type="button"
              aria-label={`Cart${itemCount > 0 ? `, ${itemCount} items` : ''}`}
              tabIndex={visible ? 0 : -1}
              onClick={openDrawer}
              style={itemStyle}
            >
              {content}
            </button>
          );
        }

        const href = item.key === 'home' ? '/' : item.key === 'shop' ? '/products' : accountHref;
        return (
          <Link
            key={item.key}
            href={href}
            aria-label={item.label}
            tabIndex={visible ? 0 : -1}
            style={itemStyle}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
