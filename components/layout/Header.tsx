'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Wordmark from '@/components/ui/Wordmark';
import IconButton from '@/components/ui/IconButton';
import { useBreakpoint } from '@/lib/hooks/useBreakpoint';
import { getSession, type Session } from '@/lib/session';
import { useUser, useLogout } from '@/lib/hooks/use-auth';
import CustomerRoleBadge from '@/components/account/CustomerRoleBadge';
import type { ResolvedChrome } from '@/lib/api/storefront';

interface HeaderProps {
  navbar: ResolvedChrome['navbar'];
  onOpenCart?: () => void;
  cartCount?: number;
  transparent?: boolean;
}

export default function Header({ navbar, onOpenCart, cartCount = 0, transparent = false }: HeaderProps) {
  const [scrolled, setScrolled] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [bump, setBump] = React.useState(false);
  const [session, setSession] = React.useState<Session | null>(null);
  const [accountOpen, setAccountOpen] = React.useState(false);
  const prevCount = React.useRef(cartCount);
  const router = useRouter();
  const logoutMutation = useLogout();
  const { data: authUser } = useUser();
  const { mobile } = useBreakpoint();

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

  const isLight = transparent && !scrolled;

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
              {navbar.desktop.map(({ id, href, label }) => (
                <a
                  key={id}
                  href={href}
                  className="mr-nav-link"
                  style={{ color: 'inherit', textDecoration: 'none', cursor: 'pointer' }}
                >
                  {label}
                </a>
              ))}
            </nav>
          )}

          {/* Center: Wordmark */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Wordmark
              size={mobile ? 18 : 22}
              color={isLight ? 'var(--mr-cream-100)' : 'var(--mr-gold-500)'}
              captionColor={isLight ? 'rgba(253,251,245,0.65)' : 'var(--mr-ink-500)'}
            />
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
            {!mobile && navbar.showSearch && (
              <IconButton icon="search" label="Search" tone={isLight ? 'glass' : 'cream'} />
            )}
            {!mobile && navbar.showAccount && (
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
                        <CustomerRoleBadge role={authUser?.role ?? session.role} />
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
      </header>

      {/* Mobile nav drawer */}
      {mobile && (
        <>
          <div
            onClick={() => setMobileOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(11,11,11,0.5)',
              backdropFilter: mobileOpen ? 'blur(4px)' : 'blur(0)',
              opacity: mobileOpen ? 1 : 0,
              pointerEvents: mobileOpen ? 'auto' : 'none',
              transition: 'opacity 280ms var(--mr-ease-snappy), backdrop-filter 280ms',
              zIndex: 60,
            }}
          />
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              width: 280,
              background: 'var(--mr-cream-100)',
              zIndex: 70,
              transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
              transition: 'transform 340ms var(--mr-ease-out)',
              padding: '32px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 32,
              }}
            >
              <Wordmark size={20} />
              <IconButton
                icon="close"
                size={36}
                tone="cream"
                label="Close"
                onClick={() => setMobileOpen(false)}
              />
            </div>
            {navbar.mobile.map(({ id, href, label }, i) => (
              <a
                key={id}
                href={href}
                onClick={() => setMobileOpen(false)}
                style={{
                  display: 'block',
                  background: 'none',
                  border: 0,
                  textAlign: 'left',
                  padding: '14px 0',
                  borderBottom: '1px solid var(--mr-hairline)',
                  fontFamily: 'Cormorant Garamond, serif',
                  fontSize: 22,
                  color: 'var(--mr-ink-900)',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  animation: 'mr-fade-up 0.4s cubic-bezier(0.16,1,0.3,1) both',
                  animationDelay: mobileOpen ? `${i * 40 + 80}ms` : '0ms',
                }}
              >
                {label}
              </a>
            ))}
          </div>
        </>
      )}
    </>
  );
}
