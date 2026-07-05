/**
 * Unit tests — app/(auth)/reset-password/page.tsx
 * Covers: no-token guard, validation, success redirect,
 *         expired/invalid token (400/404/410), generic error, offline error.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockPush = jest.fn();
let mockToken = 'valid-reset-token';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'token' ? mockToken : null),
  }),
}));

const mockApiResetPassword = jest.fn();
jest.mock('@/lib/api/auth', () => ({
  apiResetPassword: (...args: unknown[]) => mockApiResetPassword(...args),
}));

// ── Component ────────────────────────────────────────────────────────────────
import ResetPasswordPage from '@/app/(auth)/reset-password/page';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fillAndSubmit = async (password = 'NewPass12', confirm = 'NewPass12') => {
  const user = userEvent.setup();
  const fields = screen.getAllByLabelText(/password/i);
  await user.type(fields[0], password);
  await user.type(fields[1], confirm);
  await user.click(screen.getByRole('button', { name: /set new password/i }));
};

// ── Tests ────────────────────────────────────────────────────────────────────
describe('ResetPasswordPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockToken = 'valid-reset-token';
  });

  describe('no-token guard', () => {
    it('shows Invalid link state when token is absent', () => {
      mockToken = '';
      render(<ResetPasswordPage />);
      expect(screen.getByText(/invalid link/i)).toBeInTheDocument();
    });

    it('shows link to /forgot from the invalid-token state', () => {
      mockToken = '';
      render(<ResetPasswordPage />);
      expect(screen.getByRole('link', { name: /request reset link/i })).toHaveAttribute(
        'href',
        '/forgot',
      );
    });
  });

  describe('with valid token', () => {
    it('renders new password and confirm password fields', () => {
      render(<ResetPasswordPage />);
      const fields = screen.getAllByLabelText(/password/i);
      expect(fields.length).toBeGreaterThanOrEqual(2);
    });

    it('renders Reset password submit button', () => {
      render(<ResetPasswordPage />);
      expect(screen.getByRole('button', { name: /set new password/i })).toBeInTheDocument();
    });
  });

  describe('field validation', () => {
    it('shows error when password is shorter than 8 chars', async () => {
      render(<ResetPasswordPage />);
      await fillAndSubmit('short', 'short');
      await waitFor(() =>
        expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument(),
      );
      expect(mockApiResetPassword).not.toHaveBeenCalled();
    });

    it('shows error when passwords do not match', async () => {
      render(<ResetPasswordPage />);
      await fillAndSubmit('Password1', 'Different2');
      await waitFor(() =>
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument(),
      );
      expect(mockApiResetPassword).not.toHaveBeenCalled();
    });
  });

  describe('success flow', () => {
    it('calls apiResetPassword with token and new password', async () => {
      mockApiResetPassword.mockResolvedValueOnce(undefined);
      render(<ResetPasswordPage />);
      await fillAndSubmit();
      await waitFor(() =>
        expect(mockApiResetPassword).toHaveBeenCalledWith('valid-reset-token', 'NewPass12'),
      );
    });

    it('redirects to /login?reset=success after success', async () => {
      mockApiResetPassword.mockResolvedValueOnce(undefined);
      render(<ResetPasswordPage />);
      await fillAndSubmit();
      await waitFor(() =>
        expect(mockPush).toHaveBeenCalledWith('/login?reset=success'),
      );
    });

    it('shows loading state while in-flight', async () => {
      let resolve!: (_?: unknown) => void;
      mockApiResetPassword.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
      render(<ResetPasswordPage />);
      await fillAndSubmit();
      expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
      resolve();
    });
  });

  describe('error handling', () => {
    it('shows expired/invalid link message on 400', async () => {
      mockApiResetPassword.mockRejectedValueOnce({ status: 400, message: 'Bad Request' });
      render(<ResetPasswordPage />);
      await fillAndSubmit();
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(/expired or is invalid/i),
      );
    });

    it('shows expired/invalid link message on 404', async () => {
      mockApiResetPassword.mockRejectedValueOnce({ status: 404, message: 'Not Found' });
      render(<ResetPasswordPage />);
      await fillAndSubmit();
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(/expired or is invalid/i),
      );
    });

    it('shows expired/invalid link message on 410 (Gone)', async () => {
      mockApiResetPassword.mockRejectedValueOnce({ status: 410, message: 'Gone' });
      render(<ResetPasswordPage />);
      await fillAndSubmit();
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(/expired or is invalid/i),
      );
    });

    it('shows generic error on 500', async () => {
      mockApiResetPassword.mockRejectedValueOnce({ status: 500, message: 'Internal Server Error' });
      render(<ResetPasswordPage />);
      await fillAndSubmit();
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(/something went wrong/i),
      );
    });

    it('shows offline message when status is 0', async () => {
      mockApiResetPassword.mockRejectedValueOnce({ status: 0, message: 'Network Error' });
      render(<ResetPasswordPage />);
      await fillAndSubmit();
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(/unable to connect/i),
      );
    });
  });
});
