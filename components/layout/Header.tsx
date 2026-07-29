'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Wordmark from '@/components/ui/Wordmark';
import IconButton from '@/components/ui/IconButton';
import { useBreakpoint } from '@/lib/hooks/useBreakpoint';
import { getSession, type Session } from '@/lib/session';
import { useUser, useLogout } from '@/lib/hooks/use-auth';
import MobileNavSheet from '@/components/layout/MobileNavSheet';
import NavCategorySheet from '@/components/layout/NavCategorySheet';
import SearchSheet from '@/components/layout/SearchSheet';
import { useStorefrontChrome } from '@/lib/hooks/use-storefront';
import type { ResolvedChrome, ResolvedNavItem } from '@/lib/api/storefront';

interface HeaderProps {
  navbar: ResolvedChrome['navbar'];
  onOpenCart?: () => void;
  cartCount?: number;
  transparent?: boolean;
}

/** Hover intent: opening on the first pixel makes the menu fire while the
 *  pointer is only passing through; closing on the first pixel out makes the
 *  gap between the link and the panel a dead zone. */
const HOVER_OPEN_MS = 90;
const HOVER_CLOSE_MS = 220;

export default function Header({ navbar, onOpenCart, cartCount = 0, transparent = false }: HeaderProps) {
  const [scrolled, setScrolled] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [hoveredNavId, setHoveredNavId] = React.useState<string | null>(null);
  const [bump, setBump] = React.useState(false);
  const [session, setSession] = React.useState<Session | null>(null);
  const [accountOpen, setAccountOpen] = React.useState(false);
  const prevCount = React.useRef(cartCount);
  const hoverTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const logoutMutation = useLogout();
  const { data: authUser } = useUser();
  const { mobile } = useBreakpoint();
  // Socials for the mobile sheet's footer bar. Read from the same cached chrome
  // query the page already resolved, so this costs no extra request; an empty
  // list simply renders no icons.
  const { data: chrome } = useStorefrontChrome();
  const socials = chrome?.footer.socials ?? [];

  React.useEffect(() => {
    setSession(getSession());
  }, []);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  React.useEffect(() => {
    if (cartCount > prevCount.current) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 450);
      prevCount.current = cartCount;
      return () => clearTimeout(t);
    }
    prevCount.current = cartCount;
  }, [cartCount]);

  React.useEffect(() => () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  }, []);

  const scheduleHover = (id: string | null, delay: number) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHoveredNavId(id), delay);
  };

  /** Only category items the admin pinned products to open a panel. */
  const panelItems = React.useMemo(
    () => navbar.items.filter((i) => (i.featured?.length ?? 0) > 0),
    [navbar.items],
  );
  const hoveredItem: ResolvedNavItem | null =
    panelItems.find((i) => i.id === hoveredNavId) ?? null;

  const closeDropdown = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setHoveredNavId(null);
  };

  // The dropdown is a cream panel; a transparent header sitting on top of it
  // would render its links cream-on-cream. Opening one forces the solid state.
  const isLight = transparent && !scrolled && hoveredItem === null;

  return (
    <>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: isLight ? 'transparent' : 'rgba(246,242,233,0.93)',
          backdropFilter: isLight ? 'none' : 'blur(18px)',
          WebkitBackdropFilter: isLight ? 'none' : 'blur(18px)',
          borderBottom: isLight ? '1px solid transparent' : '1px solid var(--mr-hairline)',
          color: isLight ? 'var(--mr-cream-100)' : 'var(--mr-ink-900)',
          transition:
            'background 360ms var(--mr-ease-out), border-color 360ms var(--mr-ease-out), color 360ms var(--mr-ease-out)',
        }}
      >
        <div
          className="mr-header-inner"
          style={{
            display: 'grid',
            gridTemplateColumns: mobile ? '44px 1fr 44px' : '1fr auto 1fr',
            alignItems: 'center',
            padding: scrolled
              ? mobile ? '10px 16px' : '14px 48px'
              : mobile ? '16px 16px' : '22px 48px',
            maxWidth: 1440,
            margin: '0 auto',
          }}
        >
          {/* Left: Nav or Hamburger */}
          {mobile ? (
            <IconButton
              icon="menu"
              size={40}
              tone={isLight ? 'glass' : 'cream'}
              label="Menu"
              onClick={() => setMobileOpen(true)}
            />
          ) : (
            <nav
              style={{
                display: 'flex',
                gap: 28,
                fontFamily: 'Jost, sans-serif',
                fontSize: 12,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
              }}
            >
              {navbar.items.map((item) => {
                const hasPanel = (item.featured?.length ?? 0) > 0;
                return (
                  <a
                    key={item.id}
                    href={item.href}
                    className="mr-nav-link"
                    aria-expanded={hasPanel ? hoveredNavId === item.id : undefined}
                    onMouseEnter={() =>
                      scheduleHover(hasPanel ? item.id : null, HOVER_OPEN_MS)
                    }
                    onMouseLeave={() => scheduleHover(null, HOVER_CLOSE_MS)}
                    // Keyboard users get the same panel: focusing the link opens it,
                    // Escape closes it without leaving the link.
                    onFocus={() => hasPanel && setHoveredNavId(item.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') closeDropdown();
                    }}
                    style={{ color: 'inherit', textDecoration: 'none', cursor: 'pointer' }}
                  >
                    {item.label}
                  </a>
                );
              })}
            </nav>
          )}

          {/* Center: Wordmark — links home like any storefront logo */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Link
              href="/"
              aria-label="MiniRue — home"
              data-trace-id="PG-STOREFRONT-HOME-001::EL-LINK-wordmark-home"
              style={{ display: 'inline-flex', textDecoration: 'none', color: 'inherit' }}
            >
              <Wordmark
                size={mobile ? 18 : 22}
                color={isLight ? 'var(--mr-cream-100)' : 'var(--mr-gold-500)'}
                captionColor={isLight ? 'rgba(253,251,245,0.65)' : 'var(--mr-ink-500)'}
              />
            </Link>
          </div>

          {/* Right: Icons */}
          <div
            style={{
              display: 'flex',
              gap: mobile ? 6 : 10,
              justifyContent: 'flex-end',
              alignItems: 'center',
            }}
          >
            {/* Search — now in the bar on phones too. It opens a sheet rather
                than navigating, so it costs no page load; burying the single
                most-used control one tap deep inside the hamburger was the
                wrong trade on a mobile-first storefront. */}
            <IconButton
              icon="search"
              label="Search"
              tone={isLight ? 'glass' : 'cream'}
              onClick={() => setSearchOpen(true)}
            />
            {/* Account — desktop identity menu; on mobile it lives inside the
                hamburger menu. */}
            {!mobile && (
              session ? (
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setAccountOpen((o) => !o)}
                    data-trace-id="PG-STOREFRONT-IAM-006::EL-BTN-account-menu-trigger"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'Jost, sans-serif',
                      fontSize: 11,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: 'inherit',
                      padding: '6px 0',
                    }}
                  >
                    Hi, {(authUser?.name ?? session.name)?.split(' ')[0] || 'there'}
                  </button>
                  {accountOpen && (
                    <div
                      data-trace-id="PG-STOREFRONT-IAM-006::EL-MENU-account-dropdown"
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        right: 0,
                        background: 'var(--mr-cream-100)',
                        border: '1px solid var(--mr-hairline)',
                        borderRadius: 'var(--mr-radius-md)',
                        boxShadow: 'var(--mr-shadow-lg)',
                        minWidth: 160,
                        zIndex: 100,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          padding: '14px 18px',
                          borderBottom: '1px solid var(--mr-hairline)',
                          background: 'var(--mr-bg-raised)',
                        }}
                      >
                        <p
                          style={{
                            margin: '0 0 6px',
                            fontFamily: 'Cormorant Garamond, serif',
                            fontSize: 16,
                            color: 'var(--mr-ink-900)',
                          }}
                        >
                          {authUser?.name ?? session.name}
                        </p>
                        <p
                          style={{
                            margin: '0 0 10px',
                            fontSize: 11,
                            color: 'var(--mr-ink-500)',
                          }}
                        >
                          {authUser?.email ?? session.email}
                        </p>
                        {/* No role badge. Everyone who can see this menu is a
                            customer, so labelling them one is telling a shopper
                            something they already know in a word from our
                            internal vocabulary. */}
                      </div>
                      {[
                        { label: 'Account', href: '/account/profile' },
                        { label: 'Orders', href: '/account/orders' },
                      ].map(({ label, href }) => (
                        <Link
                          key={label}
                          href={href}
                          onClick={() => setAccountOpen(false)}
                          data-trace-id={`PG-STOREFRONT-IAM-006::EL-LINK-account-nav-item@${label.toLowerCase()}`}
                          style={{
                            display: 'block',
                            padding: '12px 18px',
                            fontFamily: 'Jost, sans-serif',
                            fontSize: 11,
                            letterSpacing: '0.18em',
                            textTransform: 'uppercase',
                            color: 'var(--mr-ink-900)',
                            textDecoration: 'none',
                            borderBottom: '1px solid var(--mr-hairline)',
                          }}
                        >
                          {label}
                        </Link>
                      ))}
                      <div
                        role="button"
                        tabIndex={0}
                        aria-disabled={logoutMutation.isPending}
                        data-trace-id="PG-STOREFRONT-IAM-006::EL-BTN-sign-out-header"
                        onClick={() => {
                          // 2026-07-07 v5 §26 Rule 4 fix: was a parallel direct
                          // clearTokens() + clearSession() path. Now routes through
                          // useLogout() — the single source of truth for sign-out.
                          // onSuccess clears tokens, session, and queries; then we
                          // navigate to the storefront home per US-SHOPPER-IAM-003.
                          logoutMutation.mutate(undefined, {
                            onSuccess: () => {
                              setSession(null);
                              setAccountOpen(false);
                              router.push('/');
                            },
                            onError: () => {
                              setSession(null);
                              setAccountOpen(false);
                              router.push('/');
                            },
                          });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            logoutMutation.mutate(undefined, {
                              onSuccess: () => {
                                setSession(null);
                                setAccountOpen(false);
                                router.push('/');
                              },
                              onError: () => {
                                setSession(null);
                                setAccountOpen(false);
                                router.push('/');
                              },
                            });
                          }
                        }}
                        style={{
                          padding: '12px 18px',
                          fontFamily: 'Jost, sans-serif',
                          fontSize: 11,
                          letterSpacing: '0.18em',
                          textTransform: 'uppercase',
                          color: 'var(--mr-ink-400)',
                          cursor: logoutMutation.isPending ? 'default' : 'pointer',
                          opacity: logoutMutation.isPending ? 0.6 : 1,
                        }}
                      >
                        {logoutMutation.isPending ? 'Signing out\u2026' : 'Sign out'}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href="/login"
                  style={{
                    fontFamily: 'Jost, sans-serif',
                    fontSize: 11,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: 'inherit',
                    textDecoration: 'none',
                  }}
                >
                  Sign in
                </Link>
              )
            )}
            <IconButton
              icon="bag"
              label="Bag"
              tone={isLight ? 'glass' : 'cream'}
              onClick={onOpenCart}
              badge={cartCount}
              badgeBump={bump}
            />
          </div>
        </div>

        {/* Desktop category dropdown. Rendered inside <header> so it hangs off
            the sticky bar and travels with it; never on phones, where the
            bottom sheet owns the same content. */}
        {!mobile && panelItems.length > 0 && (
          <NavCategorySheet
            item={hoveredItem}
            open={hoveredItem !== null}
            onMouseEnter={() => {
              if (hoverTimer.current) clearTimeout(hoverTimer.current);
            }}
            onMouseLeave={() => scheduleHover(null, HOVER_CLOSE_MS)}
            onNavigate={closeDropdown}
          />
        )}
      </header>

      <SearchSheet
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        suggestions={navbar.items.map((i) => i.label)}
      />

      {/* Mobile nav — bottom sheet */}
      {mobile && (
        <MobileNavSheet
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          navbar={navbar}
          socials={socials}
          signedIn={Boolean(session)}
          onOpenSearch={() => setSearchOpen(true)}
        />
      )}

    </>
  );
}
