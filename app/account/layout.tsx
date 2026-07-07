/**
 * Account layout — customer self-service (Role.CUSTOMER)
 * Protection: middleware checks mr-auth cookie on /account/*
 */
import type { Metadata } from 'next';
import AccountLayoutClient from './AccountLayoutClient';

export const metadata: Metadata = {
  title: 'My Account — MiniRue',
  robots: 'noindex, nofollow',
};

// /account/* is auth-protected (middleware checks mr-auth cookie).
// Never prerender — every request is user-specific.
export const dynamic = 'force-dynamic';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <AccountLayoutClient>{children}</AccountLayoutClient>;
}
