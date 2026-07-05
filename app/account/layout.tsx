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

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <AccountLayoutClient>{children}</AccountLayoutClient>;
}
