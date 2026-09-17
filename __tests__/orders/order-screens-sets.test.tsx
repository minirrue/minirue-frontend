import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import OrderLineList, { SetSavingsRow } from '@/components/orders/OrderLineList';
import type { OrderItemSummary, OrderSummary } from '@/lib/checkout/checkout-api';

/**
 * #116 on the screens themselves: a 2-piece set and a product, exactly as the
 * API sends them — member rows sharing a bundleId, amounts as "NNN.0000".
 */

jest.mock('@/components/ui/RemoteImage', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} data-testid="thumb" />,
}));

const mockApiListOrders = jest.fn();
const mockApiGetOrder = jest.fn();
jest.mock('@/lib/checkout/checkout-api', () => ({
  apiListOrders: (...args: unknown[]) => mockApiListOrders(...args),
  apiGetOrder: (...args: unknown[]) => mockApiGetOrder(...args),
}));
jest.mock('@/lib/api/refunds', () => ({
  apiListMyRefunds: () => Promise.resolve({ data: [] }),
}));
jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'o1' }),
  useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }),
}));

import OrderHistoryClient from '@/app/account/orders/OrderHistoryClient';
import OrderDetailClient from '@/app/account/orders/[id]/OrderDetailClient';

const SET = 'b1000000-0000-4000-8000-000000000001';
const bundle = {
  id: SET,
  name: 'Evening Set',
  slug: 'evening-set',
  imageUrl: 'https://img.test/set.jpg',
  setQty: 1,
};

const member = (id: string, name: string, amount: string): OrderItemSummary => ({
  id,
  variantId: `v-${id}`,
  qty: 1,
  unitPriceAmount: amount,
  lineTotalAmount: amount,
  productSnapshot: {
    name,
    brand: 'MiniRue',
    imageUrl: `https://img.test/${id}.jpg`,
    productSlug: `${id}-slug`,
    categorySlug: 'perfume',
  },
  bundleId: SET,
  bundleLineKey: 'k1',
  bundle,
});

const ITEMS: OrderItemSummary[] = [
  member('oud', 'Oud 10ml', '199.5000'),
  member('rose', 'Rose 10ml', '200.0000'),
  {
    id: 'musk',
    variantId: 'v-musk',
    qty: 1,
    unitPriceAmount: '799.0000',
    lineTotalAmount: '799.0000',
    productSnapshot: { name: 'White Musk', brand: 'MiniRue', imageUrl: 'https://img.test/musk.jpg' },
    bundleId: null,
    bundleLineKey: '',
    bundle: null,
  },
];

const ORDER: OrderSummary = {
  id: 'o1',
  orderNumber: 'MR-20260913-00001',
  orderSeq: 12,
  status: 'PENDING',
  totalAmount: '1198.5000',
  totalCurrency: 'EGP',
  bundleSavingsAmount: '120.0000',
  items: ITEMS,
  createdAt: '2026-09-13T10:00:00.000Z',
  refundedAt: null,
  refundedAmountCents: null,
};

const plain = (s: string | null | undefined) => (s ?? '').replace(/ /g, ' ');

describe('OrderLineList (step 4)', () => {
  it.each(['receipt'] as const)('%s: two lines, the set with its own image and set price', (variant) => {
    render(<OrderLineList items={ITEMS} currency="EGP" variant={variant} />);

    const lines = within(screen.getByTestId('order-lines')).getAllByRole('listitem');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveTextContent('Evening Set');
    expect(plain(lines[0].textContent)).toContain('EGP 399.50');
    expect(within(lines[0]).getByTestId('thumb')).toHaveAttribute('src', 'https://img.test/set.jpg');
    expect(plain(lines[1].textContent)).toContain('EGP 799');

    // No member rows, no member thumbnails, no raw amounts, no expander.
    expect(screen.queryByText('Oud 10ml')).toBeNull();
    expect(screen.getAllByTestId('thumb')).toHaveLength(2);
    expect(document.body.textContent).not.toMatch(/\.0000|\.00\b/);
    expect(screen.queryByTestId('set-members')).toBeNull();
  });

  it('shows set savings in the totals, formatted, and nothing when there were none', () => {
    const { rerender } = render(<SetSavingsRow amount="120.0000" currency="EGP" />);
    expect(plain(screen.getByTestId('set-savings').textContent)).toBe('Set savings−EGP 120');
    rerender(<SetSavingsRow amount="0" currency="EGP" />);
    expect(screen.queryByTestId('set-savings')).toBeNull();
    rerender(<SetSavingsRow amount={undefined} currency="EGP" />);
    expect(screen.queryByTestId('set-savings')).toBeNull();
  });
});

describe('Account → Orders tab', () => {
  it('counts the set as ONE item with the set image: 2 thumbnails, "Evening Set + 1 more"', async () => {
    mockApiListOrders.mockResolvedValue({ data: [ORDER], total: 1, page: 1, limit: 10 });
    render(<OrderHistoryClient />);

    await waitFor(() => expect(screen.getByText('Evening Set + 1 more')).toBeInTheDocument());
    const thumbs = screen.getAllByTestId('thumb').map((img) => img.getAttribute('src'));
    expect(thumbs).toEqual(['https://img.test/set.jpg', 'https://img.test/musk.jpg']);
  });
});

describe('Account → order detail', () => {
  it('shows the set as one line that opens to its members as product-page links only', async () => {
    mockApiGetOrder.mockResolvedValue(ORDER);
    render(<OrderDetailClient />);

    const list = await screen.findByTestId('order-lines');
    const lines = within(list).getAllByRole('listitem').filter((li) => li.dataset.lineKind);
    expect(lines).toHaveLength(2);

    const members = within(lines[0]).getByTestId('set-members');
    expect(members).toHaveTextContent("What's in this set");
    const links = within(members).getAllByRole('link');
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Oud 10ml', '/shop/perfume/oud-slug'],
      ['Rose 10ml', '/shop/perfume/rose-slug'],
    ]);
    // Links only: no member image and no member price inside the expander.
    expect(within(members).queryByTestId('thumb')).toBeNull();
    expect(members.textContent).not.toMatch(/EGP/);

    expect(plain(screen.getByTestId('set-savings').textContent)).toBe('Set savings−EGP 120');
    expect(plain(document.body.textContent)).toContain('EGP 1,198.50');
  });
});
