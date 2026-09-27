import { render, screen } from '@testing-library/react';
import OrderSourceLabel from '@/components/orders/OrderSourceLabel';

test('identifies Ground history without exposing profile identifiers', () => {
  render(<OrderSourceLabel salesMode="GROUND" />);
  expect(screen.getByText('Bought at Ground')).toBeInTheDocument();
});
test('identifies assisted Online history', () => {
  render(<OrderSourceLabel salesMode="ONLINE" />);
  expect(screen.getByText('Assisted online')).toBeInTheDocument();
});
test('does not mislabel ordinary website and legacy orders', () => {
  const { container } = render(<OrderSourceLabel />);
  expect(container).toBeEmptyDOMElement();
});
