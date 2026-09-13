import React from 'react';
import { render, screen } from '@testing-library/react';
import Button from '@/components/ui/Button';

/**
 * An icon sits BESIDE its label (frontend#112).
 *
 * The swept Button wraps its children in one span so the sweep panel cannot
 * paint over the words. Tailwind's preflight makes every svg display:block, so
 * in a plain inline span the product page's tick rendered above "Added". The
 * wrapper is now an inline flex row with the button's own gap.
 */
describe('Button label row', () => {
  it('lays a swept label out as a centred inline flex row', () => {
    render(
      <Button>
        <svg data-testid="tick" /> Added
      </Button>,
    );
    const wrapper = screen.getByTestId('tick').parentElement as HTMLElement;
    expect(wrapper.tagName).toBe('SPAN');
    expect(wrapper.style.display).toBe('inline-flex');
    expect(wrapper.style.alignItems).toBe('center');
    expect(wrapper.style.gap).toBe('inherit');
  });
});
