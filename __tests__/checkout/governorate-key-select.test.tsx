import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GovernorateKeySelect from '@/components/checkout/GovernorateKeySelect';
import { GOVERNORATES } from '@/lib/checkout/governorates';

/**
 * frontend#158/#163 — the ADDRESS governorate field as a closed `<select>`
 * of the 27 keys, a sibling of `GovernorateSelect` (#83's free-text /
 * shipping-rate-table component) but never the same value space: this one
 * only ever shows or picks a real `GovernorateKey`, never free text.
 */

describe('GovernorateKeySelect', () => {
  it('renders all 27 governorates plus the placeholder', async () => {
    render(<GovernorateKeySelect value="" onChange={jest.fn()} />);
    const select = screen.getByLabelText(/governorate/i) as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toEqual(['', ...GOVERNORATES.map((g) => g.key)]);
    expect(screen.getByRole('option', { name: 'Cairo' })).toBeInTheDocument();
  });

  it('shows the English label, hands back the key on change', async () => {
    const onChange = jest.fn();
    render(<GovernorateKeySelect value="" onChange={onChange} />);
    const select = screen.getByLabelText(/governorate/i);
    await userEvent.selectOptions(select, 'Cairo');
    expect(onChange).toHaveBeenCalledWith('CAIRO');
  });

  it('preselects the value it is given', () => {
    render(<GovernorateKeySelect value="GIZA" onChange={jest.fn()} />);
    const select = screen.getByLabelText(/governorate/i) as HTMLSelectElement;
    expect(select.value).toBe('GIZA');
  });

  it('shows an unselected placeholder for an empty value, with an error when given one', () => {
    render(
      <GovernorateKeySelect value="" onChange={jest.fn()} error="Select a governorate." />,
    );
    const select = screen.getByLabelText(/governorate/i) as HTMLSelectElement;
    expect(select.value).toBe('');
    expect(screen.getByRole('alert')).toHaveTextContent('Select a governorate.');
  });
});
