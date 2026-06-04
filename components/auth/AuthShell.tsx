import React from 'react';
import Link from 'next/link';
import Wordmark from '@/components/ui/Wordmark';
import AuthCard from './AuthCard';

interface AuthShellProps {
  children: React.ReactNode;
}

export default function AuthShell({ children }: AuthShellProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(150deg, var(--mr-crimson-700) 0%, var(--mr-ink-900) 100%)',
        padding: '40px 16px',
        gap: 32,
        animation: 'mr-fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both',
      }}
    >
      <Link href="/" style={{ textDecoration: 'none' }}>
        <Wordmark size={24} color="var(--mr-cream-100)" captionColor="rgba(253,251,245,0.55)" />
      </Link>
      <AuthCard>{children}</AuthCard>
      <Link
        href="/"
        style={{
          fontFamily: 'Jost, sans-serif',
          fontSize: 11,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'rgba(253,251,245,0.55)',
          textDecoration: 'none',
        }}
      >
        Back to store
      </Link>
    </div>
  );
}
