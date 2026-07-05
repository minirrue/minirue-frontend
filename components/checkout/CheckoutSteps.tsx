'use client';

import Link from 'next/link';
import { useBreakpoint } from '@/lib/hooks/useBreakpoint';

const STEPS = [
  { n: 1, label: 'Bag', href: '/cart' },
  { n: 2, label: 'Delivery', href: '/checkout' },
  { n: 3, label: 'Payment', href: '/checkout/payment' },
  { n: 4, label: 'Confirmation', href: null },
] as const;

interface Props {
  current: 1 | 2 | 3 | 4;
}

export default function CheckoutSteps({ current }: Props) {
  const { mobile } = useBreakpoint();

  return (
    <nav aria-label="Checkout progress" style={{ marginBottom: 'var(--mr-sp-6)' }}>
      <ol
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexWrap: 'wrap',
          gap: mobile ? 'var(--mr-sp-2) var(--mr-sp-4)' : 'var(--mr-sp-3) var(--mr-sp-6)',
          alignItems: 'center',
        }}
      >
        {STEPS.map((step, i) => {
          const done = step.n < current;
          const active = step.n === current;
          const canLink = done && step.href;

          const content = (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--mr-sp-2)',
                fontFamily: 'var(--mr-font-label)',
                fontSize: mobile ? 9 : 10,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: active
                  ? 'var(--mr-ink-900)'
                  : done
                    ? 'var(--mr-ink-500)'
                    : 'var(--mr-ink-400)',
                fontWeight: active ? 600 : 400,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: mobile ? 22 : 26,
                  height: mobile ? 22 : 26,
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  border: active
                    ? '1px solid var(--mr-ink-900)'
                    : done
                      ? '1px solid var(--mr-gold-400)'
                      : '1px solid var(--mr-hairline)',
                  background: done ? 'var(--mr-gold-100)' : active ? 'var(--mr-ink-900)' : 'transparent',
                  color: active ? 'var(--mr-cream-100)' : done ? 'var(--mr-ink-700)' : 'var(--mr-ink-400)',
                }}
              >
                {done ? '✓' : step.n}
              </span>
              {!mobile && step.label}
            </span>
          );

          return (
            <li key={step.n} style={{ display: 'flex', alignItems: 'center', gap: 'var(--mr-sp-3)' }}>
              {canLink ? (
                <Link href={step.href} style={{ textDecoration: 'none' }}>
                  {content}
                </Link>
              ) : (
                content
              )}
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden
                  style={{
                    width: mobile ? 12 : 24,
                    height: 1,
                    background: step.n < current ? 'var(--mr-gold-300)' : 'var(--mr-hairline)',
                  }}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
