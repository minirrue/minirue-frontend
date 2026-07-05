'use client';

import React from 'react';
import CheckoutSteps from './CheckoutSteps';
import { useBreakpoint } from '@/lib/hooks/useBreakpoint';

interface Props {
  step: 1 | 2 | 3 | 4;
  eyebrow?: string;
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: number;
}

export default function CheckoutPageFrame({
  step,
  eyebrow,
  title,
  subtitle,
  children,
  maxWidth = 640,
}: Props) {
  const { mobile } = useBreakpoint();

  return (
    <main
      data-screen-label={`Checkout · step ${step}`}
      style={{
        maxWidth: 'var(--mr-content-max)',
        margin: '0 auto',
        padding: mobile
          ? 'var(--mr-sp-6) var(--mr-gutter) var(--mr-sp-8)'
          : 'var(--mr-sp-7) var(--mr-gutter) var(--mr-sp-9)',
      }}
    >
      <CheckoutSteps current={step} />

      {eyebrow && (
        <p
          style={{
            fontFamily: 'var(--mr-font-label)',
            fontSize: 'var(--mr-text-xs)',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--mr-gold-500)',
            margin: '0 0 var(--mr-sp-3)',
          }}
        >
          {eyebrow}
        </p>
      )}

      <h1
        style={{
          fontFamily: 'var(--mr-font-serif)',
          fontSize: mobile ? 'var(--mr-text-xl)' : 'var(--mr-text-2xl)',
          fontWeight: 400,
          color: 'var(--mr-fg)',
          margin: '0 0 var(--mr-sp-3)',
          letterSpacing: '-0.01em',
          textWrap: 'balance',
        }}
      >
        {title}
      </h1>

      {subtitle && (
        <div
          style={{
            fontFamily: 'var(--mr-font-ui)',
            fontSize: 'var(--mr-text-sm)',
            color: 'var(--mr-fg-3)',
            marginBottom: 'var(--mr-sp-6)',
            maxWidth: '52ch',
            lineHeight: 1.55,
          }}
        >
          {subtitle}
        </div>
      )}

      <div style={{ maxWidth, margin: subtitle ? undefined : 'var(--mr-sp-5) auto 0' }}>
        {children}
      </div>
    </main>
  );
}
