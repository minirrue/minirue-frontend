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
  const { direction, atTop } = useScrollDirection();
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
  const visible = belowBreakpoint && !atTop && direction === 'down';

  const accountHref = session ? '/account/profile' : '/login';

  return (
    <nav
      aria-label="Primary"
      data-testid="mobile-bottom-nav"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        // Z-order rule (stated in the task report): the PDP sticky buy bar
        // (ApiProductDetail.tsx, Tailwind `z-30`) must never be covered — it
        // is the primary purchase action. This bar sits below it at 20, so
        // on a product page the two can be visually adjacent without ever
        // double-stacking the buy bar underneath this nav.
        zIndex: 20,
        display: belowBreakpoint ? 'flex' : 'none',
        height: BAR_HEIGHT,
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'rgba(246,242,233,0.96)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        borderTop: '1px solid var(--mr-hairline)',
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        transition: reducedMotion ? 'none' : 'transform 280ms var(--mr-ease-out)',
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
