import React from 'react';
import { render, screen } from '@testing-library/react';
import CheckoutSteps from '@/components/checkout/CheckoutSteps';

/**
 * W3.6 — step 4 (Confirmation) showed the numeral "4" instead of a tick,
 * because `done = step.n < current` is false when a step IS the current
 * one. The stepper now takes an explicit `complete` prop so the confirmation
 * page can say "this step is also the end" without changing `<` to `<=`
 * (which would incorrectly tick step 2 while still filling it in).
 */
/** The step-4 (Confirmation) list item is always the last <li>. */
function lastStepDotText(container: HTMLElement): string | null {
  const items = container.querySelectorAll('li');
  const last = items[items.length - 1];
  return last?.querySelector('span[aria-hidden]')?.textContent ?? null;
}

describe('CheckoutSteps (W3.6)', () => {
  it('renders the numeral "4" on step 4 when merely current, not a tick', () => {
    const { container } = render(<CheckoutSteps current={4} />);
    // Steps 1-3 are genuinely done and tick — only step 4 (current, not
    // complete) is under test here.
    expect(lastStepDotText(container)).toBe('4');
  });

  it('renders a tick on step 4 when complete', () => {
    const { container } = render(<CheckoutSteps current={4} complete />);
    expect(lastStepDotText(container)).toBe('✓');
  });

  it('does not tick an in-progress step 2 when complete is not passed (guards against "<=")', () => {
    // Every real caller except the confirmation page renders CheckoutSteps
    // without `complete`. This is the regression `<=` would introduce: it
    // would tick the current step unconditionally, with no opt-in needed.
    render(<CheckoutSteps current={2} />);
    expect(screen.getByText('2', { exact: true })).toBeInTheDocument();
  });
});
