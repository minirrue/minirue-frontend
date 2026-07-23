import React from 'react';
import type { PaymentBadge as PaymentBadgeName } from '@/lib/api/storefront';

const LABELS: Record<PaymentBadgeName, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  instapay: 'InstaPay',
};

export default function PaymentBadge({ badge }: { badge: PaymentBadgeName }) {
  const common = {
    role: 'img' as const,
    'aria-label': LABELS[badge],
    height: 22,
    width: 34,
    viewBox: '0 0 34 22',
    style: { display: 'block' },
  };

  if (badge === 'visa') {
    return (
      <svg {...common}>
        <rect width="34" height="22" rx="3" fill="rgba(253,251,245,0.08)" stroke="rgba(238,230,209,0.2)" />
        <text x="17" y="15" textAnchor="middle" fontFamily="Jost, sans-serif" fontSize="9"
          letterSpacing="1.2" fill="var(--mr-cream-200)">VISA</text>
      </svg>
    );
  }

  if (badge === 'mastercard') {
    return (
      <svg {...common}>
        <rect width="34" height="22" rx="3" fill="rgba(253,251,245,0.08)" stroke="rgba(238,230,209,0.2)" />
        <circle cx="14" cy="11" r="6" fill="rgba(238,230,209,0.55)" />
        <circle cx="20" cy="11" r="6" fill="rgba(201,168,124,0.75)" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <rect width="34" height="22" rx="3" fill="rgba(253,251,245,0.08)" stroke="rgba(238,230,209,0.2)" />
      <text x="17" y="15" textAnchor="middle" fontFamily="Jost, sans-serif" fontSize="7"
        letterSpacing="0.6" fill="var(--mr-cream-200)">INSTAPAY</text>
    </svg>
  );
}
