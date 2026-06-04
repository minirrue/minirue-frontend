/**
 * Unit tests — app/(auth)/login/page.tsx
 * Covers: success redirect, error banner, loading state, rate-limit countdown,
 *         field validation, 401/429/422/500 error branches.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks (must be hoisted before page import) ──────────────────────────────

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => ({ get: () => null }),
}));

const mockApiLogin = jest.fn();
jest.mock('@/lib/api/auth', () => ({
  apiLogin: (...args: unknown[]) => mockApiLogin(...args),
}));

// Prevent real localStorage side-effects bleeding between tests
jest.mock('@/lib/auth/tokens', () => ({
  setTokens: jest.fn(),
  getAccessToken: jest.fn(() => null),
  getRefreshToken: jest.fn(() => null),
  clearTokens: jest.fn(),
}));

jest.mock('@/lib/session', () => ({
  setSession: jest.fn(),
  getSession: jest.fn(() => null),   // no existing session by default
  clearSession: jest.fn(),
}));

// ── Component under test ────────────────────────────────────────────────────
import LoginPage from '@/app/(auth)/login/page';

// ── Helpers ─────────────────────────────────────────────────────────────────
const fillAndSubmit = async (
  email = 'user@example.com',
  password = 'Password1',
) => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/email/i), email);
  await user.type(screen.getByLabelText(/password/i), password);
  await user.click(screen.getByRole('button', { name: /sign in/i }));
};

const mockAuthResponse = () => ({
  accessToken: 'acc-tok',
  refreshToken: 'ref-tok',
  user: { id: 'u1', email: 'user@example.com', firstName: 'User', role: 'customer' },
});

// ── Tests ────────────────────────────────────────────────────────────────────
describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders sign-in heading', () => {
    render(<LoginPage />);
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
  });

  it('renders email and password fields', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  describe('field validation', () => {
    it('shows email validation error for invalid email', async () => {
      render(<LoginPage />);
      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/email/i), 'not-an-email');
      await user.type(screen.getByLabelText(/password/i), 'Password1');
      await user.click(screen.getByRole('button', { name: /sign in/i }));
      await waitFor(() =>
        expect(screen.getByText(/valid email/i)).toBeInTheDocument(),
      );
      expect(mockApiLogin).not.toHaveBeenCalled();
    });

    it('shows password min-length error', async () => {
      render(<LoginPage />);
      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/email/i), 'user@example.com');
      await user.type(screen.getByLabelText(/password/i), 'short');
      await user.click(screen.getByRole('button', { name: /sign in/i }));
      await waitFor(() =>
        expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument(),
      );
      expect(mockApiLogin).not.toHaveBeenCalled();
    });
  });

  describe('success flow', () => {
    it('calls apiLogin with provided credentials', async () => {
      mockApiLogin.mockResolvedValueOnce(mockAuthResponse());
      render(<LoginPage />);
      await fillAndSubmit();
      await waitFor(() =>
        expect(mockApiLogin).toHaveBeenCalledWith('user@example.com', 'Password1'),
      );
    });

    it('redirects to / after successful login', async () => {
      mockApiLogin.mockResolvedValueOnce(mockAuthResponse());
      render(<LoginPage />);
      await fillAndSubmit();
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'));
    });

    it('shows loading state while request is in-flight', async () => {
      let resolve!: (v: ReturnType<typeof mockAuthResponse>) => void;
      mockApiLogin.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
      render(<LoginPage />);
      await fillAndSubmit();
      // Button text changes to "Signing in…" while loading
      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
      act(() => resolve(mockAuthResponse()));
    });
  });

  describe('error handling', () => {
    it('shows 401 error banner', async () => {
      mockApiLogin.mockRejectedValueOnce({ status: 401, message: 'Unauthorized' });
      render(<LoginPage />);
      await fillAndSubmit();
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(/email or password is incorrect/i),
      );
    });

    it('shows 422 error with server message', async () => {
      mockApiLogin.mockRejectedValueOnce({ status: 422, message: 'Validation failed' });
      render(<LoginPage />);
      await fillAndSubmit();
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(/validation failed/i),
      );
    });

    it('shows generic error banner for 500', async () => {
      mockApiLogin.mockRejectedValueOnce({ status: 500, message: 'Internal Server Error' });
      render(<LoginPage />);
      await fillAndSubmit();
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(/something went wrong/i),
      );
    });

    it('shows offline error when status is 0', async () => {
      // Simulate navigator.onLine = false via status 0
      mockApiLogin.mockRejectedValueOnce({ status: 0, message: 'Network Error' });
      render(<LoginPage />);
      await fillAndSubmit();
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(/unable to connect/i),
      );
    });
  });

  describe('rate-limit countdown (429)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('shows rate-limit message and sets 60s countdown on 429', async () => {
      mockApiLogin.mockRejectedValueOnce({ status: 429, message: 'Too Many Requests' });
      render(<LoginPage />);

      // Use real userEvent with fake timers — need legacy mode
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'user@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'Password1' },
      });
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(/too many attempts/i),
      );
    });

    it('button shows "Try again in Xs" while countdown > 0', async () => {
      mockApiLogin.mockRejectedValueOnce({ status: 429, message: 'Too Many Requests' });
      render(<LoginPage />);
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'user@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'Password1' },
      });
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(/too many attempts/i),
      );
      // Button should now show countdown text
      const button = screen.getByRole('button');
      expect(button.textContent).toMatch(/try again in \d+s/i);
      expect(button).toBeDisabled();
    });

    it('countdown decrements after 1 second', async () => {
      mockApiLogin.mockRejectedValueOnce({ status: 429, message: 'Too Many Requests' });
      render(<LoginPage />);
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'user@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'Password1' },
      });
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(/too many attempts/i),
      );
      act(() => jest.advanceTimersByTime(1000));
      // Countdown should have moved from 60 to 59
      await waitFor(() =>
        expect(screen.getByRole('button').textContent).toMatch(/59s/),
      );
    });
  });
});
