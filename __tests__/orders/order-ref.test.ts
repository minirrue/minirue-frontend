import { describe, expect, it } from '@jest/globals';
import { formatOrderRef } from '@/lib/orders/order-format';

describe('formatOrderRef (storefront)', () => {
  it('renders the sequence with a hash', () => {
    expect(formatOrderRef({ orderSeq: 47 })).toBe('#47');
  });

  it('renders the first order as #0 rather than blank', () => {
    expect(formatOrderRef({ orderSeq: 0 })).toBe('#0');
  });
});
