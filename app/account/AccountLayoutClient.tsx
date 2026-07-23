'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import AccountIdentityStrip from '@/components/account/AccountIdentityStrip';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { useCart } from '@/components/storefront/cart/CartContext';
import { usePublicStorefront } from '@/lib/hooks/usePublicStorefront';
import { useStorefrontChrome } from '@/lib/hooks/use-storefront';
import { FALLBACK_CHROME } from '@/lib/api/storefront';
import { useBreakpoint } from '@/lib/hooks/useBreakpoint';
import { useLogout } from '@/lib/hooks/use-auth';

const NAV_LINKS = [
  { href: '/account/profile', label: 'Profile' },
  { href: '/account/addresses', label: 'Addresses' },
  { href: '/account/orders', label: 'Orders' },
  { href: '/account/notifications', label: 'Notifications' },
  { href: '/account/loyalty', label: 'Loyalty' },
];

export default function AccountLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { itemCount, openDrawer } = useCart();
  const { storefront } = usePublicStorefront();
  const { data: chrome } = useStorefrontChrome();
  const { mobile } = useBreakpoint();
  const router = useRouter();
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const logoutMutation = useLogout();

  const handleLogout = () => {
    setLogoutError(null);
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        router.push('/');
      },
      onError: (err: unknown) => {
        const message =
          err instanceof Error ? err.message : 'Sign out failed. Please try again.';
        setLogoutError(message);
      },
    });
  };

  return (
    <>
      <div className="mr-page-sheet">
        <AnnouncementBar
          messages={storefront?.announcementMessages}
          enabled={storefront?.announcementEnabled ?? true}
          linkUrl={storefront?.announcementLinkUrl}
          background={storefront?.announcementBackground}
        />
        <Header
          navbar={chrome?.navbar ?? FALLBACK_CHROME.navbar}
          onOpenCart={openDrawer}
          cartCount={itemCount}
        />

        <div
          style={{
            display: 'flex',
            flexDirection: mobile ? 'column' : 'row',
            minHeight: 'calc(100vh - 120px)',
            background: 'var(--mr-bg)',
            fontFamily: 'var(--mr-font-ui)',
          }}
        >
          <aside
            style={{
              width: mobile ? '100%' : 220,
              flexShrink: 0,
              borderRight: mobile ? 'none' : '1px solid var(--mr-hairline)',
              borderBottom: mobile ? '1px solid var(--mr-hairline)' : 'none',
              padding: mobile ? 'var(--mr-sp-4) 0' : '40px 0',
              background: 'var(--mr-bg-raised)',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--mr-font-label)',
                fontSize: 'var(--mr-text-xs)',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--mr-fg-4)',
                padding: mobile ? '0 var(--mr-gutter) var(--mr-sp-3)' : '0 20px 16px',
              }}
            >
              My Account
            </p>
            {logoutError && (
              <div style={{ padding: mobile ? '0 var(--mr-gutter) var(--mr-sp-3)' : '0 20px 16px' }}>
                <ErrorBanner
                  message={logoutError}
                  onDismiss={() => setLogoutError(null)}
                  traceId="PG-STOREFRONT-IAM-005::EL-REGION-logout-error-banner"
                  dismissTraceId="PG-STOREFRONT-IAM-005::EL-BTN-dismiss-logout-error"
                />
              </div>
            )}
            <nav
              aria-label="Account sections"
              data-trace-id="PG-STOREFRONT-IAM-005::EL-REGION-account-nav"
              style={
                mobile
                  ? {
                      display: 'flex',
                      gap: 'var(--mr-sp-1)',
                      overflowX: 'auto',
                      padding: `0 var(--mr-gutter)`,
                      WebkitOverflowScrolling: 'touch',
                    }
                  : undefined
              }
            >
              {NAV_LINKS.map(({ href, label }) => {
                const active = pathname === href || pathname?.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    data-trace-id={`PG-STOREFRONT-IAM-005::EL-LINK-account-nav-item@${href.split('/').pop()}`}
                    style={{
                      display: 'block',
                      padding: mobile ? '10px 14px' : '10px 20px',
                      fontSize: 'var(--mr-text-sm)',
                      fontWeight: active ? 600 : 400,
                      color: active ? 'var(--mr-fg)' : 'var(--mr-fg-2)',
                      textDecoration: 'none',
                      background: active ? 'var(--mr-bg)' : 'transparent',
                      borderRadius: mobile ? 'var(--mr-radius-sm)' : 0,
                      whiteSpace: mobile ? 'nowrap' : undefined,
                      transition:
                        'color var(--mr-dur-fast) var(--mr-ease-out), background var(--mr-dur-fast) var(--mr-ease-out)',
                    }}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
            <button
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
              data-trace-id="PG-STOREFRONT-IAM-005::EL-BTN-sign-out-sidebar"
              style={{
                display: 'block',
                width: '100%',
                padding: mobile ? '10px 14px' : '10px 20px',
                fontSize: 'var(--mr-text-sm)',
                fontWeight: 400,
                color: 'var(--mr-fg-2)',
                textDecoration: 'none',
                background: 'transparent',
                border: 'none',
                borderRadius: mobile ? 'var(--mr-radius-sm)' : 0,
                cursor: logoutMutation.isPending ? 'default' : 'pointer',
                opacity: logoutMutation.isPending ? 0.6 : 1,
                textAlign: 'left',
                fontFamily: 'var(--mr-font-ui)',
                transition:
                  'color var(--mr-dur-fast) var(--mr-ease-out), background var(--mr-dur-fast) var(--mr-ease-out)',
              }}
              aria-label="Sign out"
            >
              {logoutMutation.isPending ? 'Signing out\u2026' : 'Sign out'}
            </button>
          </aside>

          <main
            style={{
              flex: 1,
              padding: mobile ? 'var(--mr-sp-6) var(--mr-gutter)' : '40px 48px',
              maxWidth: 800,
            }}
          >
            <AccountIdentityStrip />
            {children}
          </main>
        </div>
      </div>
      <Footer config={chrome?.footer ?? FALLBACK_CHROME.footer} />
    </>
  );
}
