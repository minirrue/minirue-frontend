import React from 'react';

interface AuthCardProps {
  children: React.ReactNode;
}

export default function AuthCard({ children }: AuthCardProps) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 550,
        background: 'var(--mr-cream-100)',
        borderRadius: 'var(--mr-radius-lg)',
        boxShadow: '0 8px 48px rgba(11,11,11,0.10), 0 1px 4px rgba(11,11,11,0.06)',
        padding: '48px 48px',
        boxSizing: 'border-box',
      }}
    >
      {children}
    </div>
  );
}
