import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import GroundReviewClient from '@/app/booth/review/[token]/GroundReviewClient';
import { getGroundReview, claimGroundReview, type GroundReview } from '@/lib/api/ground-review';
import { useSessionState } from '@/lib/hooks/use-session-state';

jest.mock('@/lib/api/ground-review', () => ({ getGroundReview: jest.fn(), claimGroundReview: jest.fn() }));
jest.mock('@/lib/hooks/use-session-state', () => ({ useSessionState: jest.fn() }));
jest.mock('@/components/checkout/OrderCelebration', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/ui/RemoteImage', () => ({ __esModule: true, default: () => null }));

const getReview = jest.mocked(getGroundReview);
const claim = jest.mocked(claimGroundReview);
const session = jest.mocked(useSessionState);
const review: GroundReview = {
  status: 'AWAITING_PAYMENT', salesMode: 'GROUND', currency: 'EGP',
  items: [{ id: 'v1', kind: 'VARIANT', variantId: 'v1', bundleId: null, name: 'Hair mask', sku: 'MASK', sizeMl: 500, quantity: 2, unitPriceMinor: 55000, lineTotalMinor: 110000, imageUrl: null }],
  subtotalMinor: 110000, totalMinor: 110000, shippingMinor: 0,
  loyalty: { expectedPoints: 2200, egpValueMinor: 11000, pointsPerEgp: 2, egpPerPoint: .05 },
  expiresAt: '2030-01-01', completedAt: null, orderNumber: null,
};

beforeEach(() => {
  jest.resetAllMocks();
  session.mockReturnValue({ isSignedIn: false, isSignedOut: true, status: 'signed-out', user: undefined });
  getReview.mockResolvedValue(review);
});

test('renders immutable server totals and server loyalty value, with no customer payment control', async () => {
  render(<GroundReviewClient token="opaque-token" />);
  expect(await screen.findByText('Waiting for staff confirmation')).toBeInTheDocument();
  expect(screen.getByText('2,200 expected points')).toBeInTheDocument();
  expect(screen.getByText(/110 in future reward value/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /pay|complete purchase/i })).not.toBeInTheDocument();
  expect(claim).not.toHaveBeenCalled();
});

test('polls completion and only then offers safe account return links', async () => {
  jest.useFakeTimers();
  getReview.mockResolvedValueOnce(review).mockResolvedValue({ ...review, status: 'COMPLETED', orderNumber: 'MR123' });
  render(<GroundReviewClient token="opaque-token" />);
  await act(async () => { await Promise.resolve(); });
  await act(async () => { jest.advanceTimersByTime(4000); });
  expect(screen.getByText('Purchase complete')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Create my account' })).toHaveAttribute('href', '/signup?next=%2Fbooth%2Freview%2Fopaque-token');
  await act(async () => { jest.advanceTimersByTime(8000); });
  expect(getReview).toHaveBeenCalledTimes(2);
  jest.useRealTimers();
});

test('online confirmation does not claim collection or awarded points', async () => {
  getReview.mockResolvedValue({ ...review, salesMode: 'ONLINE', status: 'COMPLETED', shippingMinor: 5000, totalMinor: 115000 });
  render(<GroundReviewClient token="opaque-token" />);
  expect(await screen.findByText('Order confirmed')).toBeInTheDocument();
  expect(screen.getByText(/Points become available after delivery/)).toBeInTheDocument();
  expect(screen.queryByText(/collected in person/i)).not.toBeInTheDocument();
});

test('expired token does not expose saved items or allow a claim', async () => {
  getReview.mockResolvedValue({ ...review, status: 'EXPIRED' });
  render(<GroundReviewClient token="opaque-token" />);
  expect(await screen.findByText('This review is no longer available')).toBeInTheDocument();
  expect(screen.queryByText('Hair mask')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Connect this purchase' })).not.toBeInTheDocument();
});

test('a refused claim remains pending and never reports success', async () => {
  session.mockReturnValue({ isSignedIn: true, isSignedOut: false, status: 'signed-in', user: undefined });
  getReview.mockResolvedValue({ ...review, status: 'COMPLETED' });
  claim.mockRejectedValue({ status: 403 });
  render(<GroundReviewClient token="opaque-token" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Connect this purchase' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Phone-only purchases stay safely recorded');
  expect(screen.queryByText('Purchase connected to your account.')).not.toBeInTheDocument();
});

test('a transient fetch failure has a retry action', async () => {
  getReview.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(review);
  render(<GroundReviewClient token="opaque-token" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(screen.getByText('Hair mask')).toBeInTheDocument());
});
