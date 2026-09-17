import { act, render, screen } from '@testing-library/react';
import OrderCelebration from '@/components/checkout/OrderCelebration';

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: () =>
    function MockConfetti({ mode }: { mode?: string }) {
      return <canvas data-testid={`confetti-${mode ?? 'boom'}`} />;
    },
}));

function mockMotionPreference(reduced: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn().mockReturnValue({
      matches: reduced,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
    }),
  });
}

function setVisibility(value: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value,
  });
}

describe('OrderCelebration (#165)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockReturnValue(0.9); // mixed boom + fall
    mockMotionPreference(false);
    setVisibility('visible');
  });

  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('mounts only after a successful order number exists', () => {
    const { rerender } = render(<OrderCelebration orderNumber={null} />);

    act(() => jest.advanceTimersByTime(1_000));
    expect(screen.queryByTestId('order-celebration')).not.toBeInTheDocument();

    rerender(<OrderCelebration orderNumber="MR-10001" />);
    act(() => jest.advanceTimersByTime(160));

    expect(screen.getByTestId('order-celebration')).toBeInTheDocument();
    expect(screen.getByTestId('confetti-boom')).toBeInTheDocument();
    expect(screen.getByTestId('confetti-fall')).toBeInTheDocument();
  });

  it('renders no confetti for reduced motion', () => {
    mockMotionPreference(true);
    render(<OrderCelebration orderNumber="MR-10001" />);

    act(() => jest.advanceTimersByTime(5_000));

    expect(screen.queryByTestId('order-celebration')).not.toBeInTheDocument();
  });

  it('clears immediately when the tab becomes hidden', () => {
    render(<OrderCelebration orderNumber="MR-10001" />);
    act(() => jest.advanceTimersByTime(160));
    expect(screen.getByTestId('order-celebration')).toBeInTheDocument();

    act(() => {
      setVisibility('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(screen.queryByTestId('order-celebration')).not.toBeInTheDocument();
  });

  it('hard-stops the celebration before thirty seconds', () => {
    render(<OrderCelebration orderNumber="MR-10001" />);
    act(() => jest.advanceTimersByTime(160));
    expect(screen.getByTestId('order-celebration')).toBeInTheDocument();

    act(() => jest.advanceTimersByTime(28_000));

    expect(screen.queryByTestId('order-celebration')).not.toBeInTheDocument();
  });
});
