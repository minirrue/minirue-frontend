import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { render, screen, within } from '@testing-library/react';

/**
 * "Where is my order" is answered on the order itself (#60, #125).
 *
 * The progress used to live on `/orders/[id]/track`, a Server Component that
 * could never load an order: its API call ran on the storefront host without
 * the shopper's cookies and hit the client-only `markAuthenticated()` on
 * success, so every order read "We could not find that order". Nothing linked
 * to it after #121 either. The progress now renders on `/account/orders/[id]`,
 * which loads the order in the browser with the shopper's session, and the old
 * address redirects there.
 *
 * MiniRue has no carrier integration and no dashboard screen creates a
 * shipment, so the order's own status is the real signal: the four states it
 * moves through, with the reached ones marked. With no carrier view to fall
 * back on it also must never say "tracking will appear here once it ships".
 *
 * These render the component and the account page, rather than reading the
 * source as the old test had to for an async Server Component.
 */

const mockApiGetOrder = jest.fn();
jest.mock('@/lib/checkout/checkout-api', () => ({
  apiGetOrder: (...args: unknown[]) => mockApiGetOrder(...args),
}));
jest.mock('@/lib/api/refunds', () => ({
  apiListMyRefunds: () => Promise.resolve({ data: [] }),
}));
jest.mock('next/navigation', () => ({ useParams: () => ({ id: 'o1' }) }));

import OrderProgress from '@/components/orders/OrderProgress';
import OrderDetailClient from '@/app/account/orders/[id]/OrderDetailClient';

const CSS = fs.readFileSync(path.join(process.cwd(), 'app/styles/mr-tokens.css'), 'utf8');

function steps() {
  const list = screen.getByRole('list', { name: 'Order progress' });
  return within(list)
    .getAllByRole('listitem')
    .map((li) => ({
      label: li.querySelector('.mr-track-step-label')?.textContent,
      reached: li.dataset.reached === 'true',
      current: li.getAttribute('aria-current') === 'step',
    }));
}

describe('OrderProgress: what it says at each point', () => {
  it('covers the four states an order really moves through, in order', () => {
    render(<OrderProgress status="PROCESSING" />);
    expect(steps().map((s) => s.label)).toEqual([
      'Confirmed',
      'Being prepared',
      'On its way',
      'Delivered',
    ]);
  });

  it('the current (yellow) confirmation step reads "Confirming", then "Confirmed" once passed (owner)', () => {
    const { unmount } = render(<OrderProgress status="CONFIRMED" />);
    expect(steps()[0]).toMatchObject({ label: 'Confirming', current: true });
    unmount();
    render(<OrderProgress status="SHIPPED" />);
    expect(steps()[0]).toMatchObject({ label: 'Confirmed', current: false });
  });

  it.each([
    ['CONFIRMED', 0],
    ['PROCESSING', 1],
    ['SHIPPED', 2],
    ['DELIVERED', 3],
  ])('%s: every step up to it is reached and it is the current one', (status, at) => {
    render(<OrderProgress status={status} />);
    const s = steps();
    expect(s.map((x) => x.reached)).toEqual([0, 1, 2, 3].map((i) => i <= at));
    // Delivered is the end, so it shows as done (green), not in progress (#159).
    expect(s.map((x) => x.current)).toEqual(
      [0, 1, 2, 3].map((i) => i === at && status !== 'DELIVERED'),
    );
    // A reached step explains itself; an unreached one does not claim anything.
    expect(screen.getAllByText(/./, { selector: '.mr-track-step-note' })).toHaveLength(at + 1);
  });

  it('PENDING: nothing is marked reached, not even "we have your payment"', () => {
    render(<OrderProgress status="PENDING" />);
    expect(steps().every((s) => !s.reached && !s.current)).toBe(true);
    expect(screen.queryByText(/we have your order and your payment/i)).toBeNull();
  });

  it.each([
    ['CANCELLED', 'cancelled'],
    ['REFUNDED', 'refunded'],
  ])('%s: says so and shows no progress towards a delivery', (status, word) => {
    render(<OrderProgress status={status} />);
    expect(screen.getByText(new RegExp(`This order was ${word}`))).toBeInTheDocument();
    expect(screen.getByText(/nothing on its way/i)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Order progress' })).toBeNull();
  });

  it('never renders the old promise that tracking will appear once it ships', () => {
    for (const status of ['CONFIRMED', 'PROCESSING', 'SHIPPED']) {
      const { container, unmount } = render(<OrderProgress status={status} />);
      expect(container.textContent).not.toMatch(/tracking information will appear/i);
      unmount();
    }
  });
});

describe('the "On its way" step shows the delivery method (frontend#163)', () => {
  /**
   * Coordinator request, 2026-09-15: the delivery method/window/fee lines
   * render INSIDE the SHIPPED step's block, using `order.delivery`, and are
   * shown regardless of whether that step has been reached — so a shopper
   * whose order is only CONFIRMED still sees what to expect once it ships.
   */
  function shippedStepText(): string {
    const list = screen.getByRole('list', { name: 'Order progress' });
    const shipped = within(list)
      .getAllByRole('listitem')
      .find((li) => li.querySelector('.mr-track-step-label')?.textContent?.match(/on its way/i));
    return shipped?.querySelector('.mr-track-step-delivery')?.textContent ?? '';
  }

  it('STANDARD: shows the method and the ETA label, even before SHIPPED', () => {
    render(
      <OrderProgress
        status="CONFIRMED"
        delivery={{
          method: 'STANDARD',
          etaLabel: '2–5 working days',
          window: null,
          location: null,
          sameDayFee: null,
        }}
        currency="EGP"
      />,
    );
    const text = shippedStepText();
    expect(text).toMatch(/method:\s*standard/i);
    expect(text).toMatch(/eta:\s*2–5 working days/i);
  });

  it('SAME_DAY, fee pending: shows the method, window and pending fee', () => {
    render(
      <OrderProgress
        status="CONFIRMED"
        delivery={{
          method: 'SAME_DAY',
          etaLabel: null,
          window: { date: '2026-09-16', start: '19:00', end: '24:00' },
          location: null,
          sameDayFee: { status: 'PENDING', amountMinor: null },
        }}
        currency="EGP"
      />,
    );
    const text = shippedStepText();
    expect(text).toMatch(/method:\s*same-day/i);
    expect(text).toMatch(/window:.*19:00–24:00/i);
    expect(text).toMatch(/same-day.*fee pending/i);
  });

  it('SAME_DAY, fee set: shows the confirmed amount, cash on delivery', () => {
    render(
      <OrderProgress
        status="SHIPPED"
        delivery={{
          method: 'SAME_DAY',
          etaLabel: null,
          window: { date: '2026-09-16', start: '19:00', end: '24:00' },
          location: null,
          sameDayFee: { status: 'SET', amountMinor: 12000 },
        }}
        currency="EGP"
      />,
    );
    const text = shippedStepText();
    expect(text).toMatch(/EGP\s*120(\.00)?/);
    expect(text).toMatch(/cash on delivery/i);
  });

  it('renders nothing extra when the order has no delivery object (a pre-#163 order)', () => {
    render(<OrderProgress status="CONFIRMED" />);
    expect(shippedStepText()).toBe('');
  });
});

describe('the account order page answers "where is my order"', () => {
  beforeEach(() => mockApiGetOrder.mockReset());

  it('shows the progress for the order it loaded with the session', async () => {
    mockApiGetOrder.mockResolvedValue({
      id: 'o1',
      orderNumber: 'MR-10042',
      orderSeq: 42,
      status: 'SHIPPED',
      totalAmount: '450.0000',
      totalCurrency: 'EGP',
      createdAt: '2026-09-10T10:00:00.000Z',
      refundedAt: null,
      refundedAmountCents: null,
      items: [],
    });
    render(<OrderDetailClient />);

    expect(await screen.findByRole('list', { name: 'Order progress' })).toBeInTheDocument();
    expect(mockApiGetOrder).toHaveBeenCalledWith('o1');
    const current = steps().find((s) => s.current);
    expect(current?.label).toBe('On its way');
  });

  it('says it could not find the order instead of "Loading order…" forever', async () => {
    // A redirected /track link for somebody else's order, or a mistyped id,
    // used to leave this page on its loading line for good.
    mockApiGetOrder.mockRejectedValue({ status: 404, message: 'Order not found' });
    render(<OrderDetailClient />);

    expect(await screen.findByText(/could not find that order/i)).toBeInTheDocument();
    expect(screen.queryByText(/loading order/i)).toBeNull();
    expect(screen.getByRole('link', { name: /back to orders/i })).toHaveAttribute(
      'href',
      '/account/orders',
    );
  });
});

describe('the state is not carried by colour alone', () => {
  it('marks the current step with aria-current and names the list', () => {
    render(<OrderProgress status="PROCESSING" />);
    const list = screen.getByRole('list', { name: 'Order progress' });
    expect(list.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
  });

  it('fills the reached dot rather than only tinting it', () => {
    /*
     * A shape change, so it survives a greyscale display and any colour-vision
     * difference. Asserted in the CSS because that is where it would be lost.
     */
    expect(CSS).toMatch(
      /\.mr-track-step\[data-reached='true'\] \.mr-track-step-dot \{[^}]*background:/,
    );
  });

  it('colours each block: green done, yellow current, red stopped (#159)', () => {
    expect(CSS).toMatch(/\.mr-track-step\[data-reached='true'\] \{[^}]*var\(--mr-st-ok-bg\)/);
    expect(CSS).toMatch(/\.mr-track-step\[data-current='true'\] \{[^}]*var\(--mr-st-warn-bg\)/);
    expect(CSS).toMatch(/\.mr-track-empty\[data-tone='danger'\] \{[^}]*var\(--mr-st-danger-bg\)/);
    const { container } = render(<OrderProgress status="CANCELLED" />);
    expect(container.querySelector('.mr-track-empty')).toHaveAttribute('data-tone', 'danger');
  });

  it('ships the classes the component renders', () => {
    const { container } = render(
      <>
        <OrderProgress status="SHIPPED" />
        <OrderProgress status="CANCELLED" />
      </>,
    );
    const used = new Set(
      Array.from(container.querySelectorAll('[class]')).flatMap((el) =>
        Array.from(el.classList),
      ),
    );
    for (const cls of [
      'mr-track-empty',
      'mr-track-steps',
      'mr-track-step',
      'mr-track-step-dot',
      'mr-track-step-label',
      'mr-track-step-note',
    ]) {
      expect(used.has(cls)).toBe(true);
      expect(CSS).toContain(`.${cls}`);
    }
  });
});
