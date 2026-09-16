import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GovernorateKeySelect from '@/components/checkout/GovernorateKeySelect';
import { GOVERNORATES } from '@/lib/checkout/governorates';

/**
 * frontend#158/#163/#168 — the ADDRESS governorate field as a closed combobox
 * of the 27 keys, a sibling of `GovernorateSelect` (#83's free-text /
 * shipping-rate-table component) but never the same value space: this one
 * only ever shows or picks a real `GovernorateKey`, never free text.
 */

describe('GovernorateKeySelect', () => {
  it('renders all 27 governorates plus the placeholder', async () => {
    const user = userEvent.setup();
    render(<GovernorateKeySelect value="" onChange={jest.fn()} />);
    const select = screen.getByRole('combobox', { name: /governorate/i });
    expect(select).toHaveTextContent('Select governorate');
    await user.click(select);
    expect(screen.getAllByRole('option')).toHaveLength(GOVERNORATES.length);
    expect(screen.getByRole('option', { name: 'Cairo' })).toBeInTheDocument();
  });

  it('shows the English label, hands back the key on change', async () => {
    const onChange = jest.fn();
    render(<GovernorateKeySelect value="" onChange={onChange} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('combobox', { name: /governorate/i }));
    await user.click(screen.getByRole('option', { name: 'Cairo' }));
    expect(onChange).toHaveBeenCalledWith('CAIRO');
  });

  it('preselects the value it is given', () => {
    render(<GovernorateKeySelect value="GIZA" onChange={jest.fn()} />);
    expect(screen.getByRole('combobox', { name: /governorate/i })).toHaveTextContent('Giza');
  });

  it('shows an unselected placeholder for an empty value, with an error when given one', () => {
    render(
      <GovernorateKeySelect value="" onChange={jest.fn()} error="Select a governorate." />,
    );
    expect(screen.getByRole('combobox', { name: /governorate/i })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Select a governorate.');
  });

  it('supports keyboard navigation, selection, and Escape', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<GovernorateKeySelect value="" onChange={onChange} />);
    const combobox = screen.getByRole('combobox', { name: /governorate/i });
    combobox.focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith(GOVERNORATES[1].key);
    await user.keyboard('{Enter}{Escape}');
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
  });
});
