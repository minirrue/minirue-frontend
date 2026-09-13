import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BrandFilterControl from '@/components/storefront/BrandFilterControl';

/**
 * The Brand filter beside Filter & sort (frontend#103).
 */
const brands = [
  { id: 'b1', name: 'YSL' },
  { id: 'b2', name: 'Dior' },
];

describe('BrandFilterControl', () => {
  it('renders nothing with fewer than two brands — one brand is not a choice', () => {
    const { container } = render(
      <BrandFilterControl brands={[brands[0]]} brandId={null} onSelect={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('opens a brand list and applies the chosen brand', async () => {
    const onSelect = jest.fn();
    render(<BrandFilterControl brands={brands} brandId={null} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: 'Filter by brand' }));
    const group = screen.getByRole('radiogroup', { name: 'Brand' });
    expect(group).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Dior' }));
    expect(onSelect).toHaveBeenCalledWith('b2');
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('shows the active brand on the button and clears back to all', async () => {
    const onSelect = jest.fn();
    render(<BrandFilterControl brands={brands} brandId="b1" onSelect={onSelect} />);
    const button = screen.getByRole('button', { name: 'Brand: YSL. Change brand' });
    expect(button).toHaveTextContent('Brand: YSL');
    await userEvent.click(button);
    expect(screen.getByRole('radio', { name: 'YSL' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('radio', { name: 'All brands' }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('closes on Escape', async () => {
    render(<BrandFilterControl brands={brands} brandId={null} onSelect={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Filter by brand' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });
});
