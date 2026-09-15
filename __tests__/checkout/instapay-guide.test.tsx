import { act, fireEvent, render, screen } from '@testing-library/react';
import InstapayGuide from '@/components/checkout/InstapayGuide';
import { DEFAULT_INSTAPAY_GUIDE } from '@/lib/api/settings';

describe('InstapayGuide (#147)', () => {
  it('links Pay with InstaPay to the pay link in a new tab', () => {
    render(<InstapayGuide guide={DEFAULT_INSTAPAY_GUIDE} amount="EGP 1,299" />);
    const link = screen.getByRole('link', { name: /pay with instapay/i });
    expect(link).toHaveAttribute('href', 'https://ipn.eg/S/rueragab/instapay/2XqchK');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByTestId('instapay-amount')).toHaveTextContent('EGP 1,299');
  });

  it('copies the handle', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<InstapayGuide guide={{ ...DEFAULT_INSTAPAY_GUIDE, handle: 'shop@instapay' }} amount="EGP 5" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy shop@instapay' }));
    });
    expect(writeText).toHaveBeenCalledWith('shop@instapay');
    expect(screen.getByText('Copied')).toBeInTheDocument();
  });

  it('holds the pay link back until the settings have answered', () => {
    render(<InstapayGuide guide={null} amount={null} />);
    expect(screen.queryByRole('link', { name: /pay with instapay/i })).toBeNull();
  });
});
