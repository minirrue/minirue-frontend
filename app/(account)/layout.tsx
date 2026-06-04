/**
 * Account layout — Identity domain (customer self-service)
 * Protection is handled by middleware.ts (mr-auth cookie check → /login redirect)
 * Middleware already guards /account/* paths.
 */
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'My Account — MiniRue',
  robots: 'noindex, nofollow',
};

const NAV_LINKS = [
  { href: '/account/profile', label: 'Profile' },
  { href: '/account/addresses', label: 'Addresses' },
  { href: '/account/orders', label: 'Orders' },
  { href: '/account/notifications', label: 'Notifications' },
  { href: '/account/loyalty', label: 'Loyalty' },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: 'var(--mr-bg)',
        fontFamily: 'var(--mr-font-ui)',
      }}
    >
      {/* Sidebar nav */}
      <aside
        style={{
          width: 220,
          flexShrink: 0,
          borderRight: '1px solid var(--mr-hairline)',
          padding: '40px 0',
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
            padding: '0 20px 16px',
          }}
        >
          My Account
        </p>
        <nav>
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              style={{
                display: 'block',
                padding: '10px 20px',
                fontSize: 'var(--mr-text-sm)',
                color: 'var(--mr-fg-2)',
                textDecoration: 'none',
                transition: `color var(--mr-dur-fast) var(--mr-ease-out)`,
              }}
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main
        style={{
          flex: 1,
          padding: '40px 48px',
          maxWidth: 800,
        }}
      >
        {children}
      </main>
    </div>
  );
}
