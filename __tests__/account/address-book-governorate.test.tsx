import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Address } from '@/lib/api/customers';
import AddressBook from '@/app/account/addresses/AddressBook';

/**
 * frontend#158 — the address book's governorate field is the closed enum,
 * not free text.
 *
 * Covers: (1) a legacy free-text governorate on an EXISTING address is
 * resolved and shown by its proper label (`resolveGovernorateKey`, applied
 * on load); (2) the add form will not save without a real key selected — no
 * silent free-text fallback.
 */

const mockApiCreateAddress = jest.fn();
const mockApiDeleteAddress = jest.fn();
const mockApiSetDefaultAddress = jest.fn();

jest.mock('@/lib/api/customers', () => ({
  apiCreateAddress: (...args: unknown[]) => mockApiCreateAddress(...args),
  apiDeleteAddress: (...args: unknown[]) => mockApiDeleteAddress(...args),
  apiSetDefaultAddress: (...args: unknown[]) => mockApiSetDefaultAddress(...args),
}));

function renderWithClient(addresses: Address[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AddressBook addresses={addresses} />
    </QueryClientProvider>,
  );
}

const BASE: Address = {
  id: 'a1',
  customerId: 'c1',
  label: 'HOME',
  line1: '1 Tahrir Sq',
  line2: null,
  city: 'Cairo',
  governorate: 'Cairo Governorate',
  postalCode: null,
  countryCode: 'EG',
  isDefault: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('AddressBook governorate display', () => {
  it('resolves a legacy free-text governorate to its label', () => {
    renderWithClient([BASE]);
    // "Cairo Governorate" normalises onto CAIRO and is shown as "Cairo", not
    // the raw stored string.
    expect(screen.getByText(/Cairo,\s*Cairo(?!\s*Governorate)/)).toBeInTheDocument();
  });

  it('falls back to the raw text when nothing resolves', () => {
    renderWithClient([{ ...BASE, governorate: 'Sixth of October' }]);
    expect(screen.getByText(/Sixth of October/)).toBeInTheDocument();
  });
});

describe('AddressBook add form', () => {
  it('blocks saving until a real governorate is selected', async () => {
    renderWithClient([BASE]);
    await userEvent.click(screen.getByRole('button', { name: /add address/i }));

    await userEvent.type(screen.getByLabelText(/address line 1/i), '10 Nile St');
    await userEvent.type(screen.getByLabelText(/city/i), 'Giza');
    await userEvent.click(screen.getByRole('button', { name: /save address/i }));

    expect(mockApiCreateAddress).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/select a governorate/i);
  });

  it('saves once a governorate key is chosen', async () => {
    mockApiCreateAddress.mockResolvedValue({ ...BASE, id: 'a2', governorate: 'GIZA' });
    renderWithClient([BASE]);
    await userEvent.click(screen.getByRole('button', { name: /add address/i }));

    await userEvent.type(screen.getByLabelText(/address line 1/i), '10 Nile St');
    await userEvent.type(screen.getByLabelText(/city/i), 'Giza');
    await userEvent.selectOptions(screen.getByLabelText(/governorate/i), 'Giza');
    await userEvent.click(screen.getByRole('button', { name: /save address/i }));

    await waitFor(() => expect(mockApiCreateAddress).toHaveBeenCalledTimes(1));
    const [input] = mockApiCreateAddress.mock.calls[0];
    expect(input.governorate).toBe('GIZA');
  });
});
