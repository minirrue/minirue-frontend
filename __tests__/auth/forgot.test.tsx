/**
 * Unit tests — app/(auth)/forgot/page.tsx
 * Covers: render, validation, success state (green sent view),
 *         FR-007 anti-enumeration (errors swallowed → always show success),
 *         loading state.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));

const mockApiForgotPassword = jest.fn();
jest.mock('@/lib/api/auth', () => ({
  apiForgotPassword: (...args: unknown[]) => mockApiForgotPassword(...args),
}));

// ── Component ────────────────────────────────────────────────────────────────
import ForgotPage from '@/app/(auth)/forgot/page';

// ── Tests ────────────────────────────────────────────────────────────────────
describe('ForgotPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Reset password heading', () => {
    render(<ForgotPage />);
    expect(screen.getByRole('heading', { name: /reset password/i })).toBeInTheDocument();
  });

  it('renders email field and submit button', () => {
    render(<ForgotPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
  });

  describe('field validation', () => {
    it('shows invalid email error and does not call API', async () => {
      render(<ForgotPage />);
      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/email/i), 'bad-email');
      await user.click(screen.getByRole('button', { name: /send reset link/i }));
      await waitFor(() =>
        expect(screen.getByText(/valid email/i)).toBeInTheDocument(),
      );
      expect(mockApiForgotPassword).not.toHaveBeenCalled();
    });
  });

  describe('success flow', () => {
    it('shows success state after valid email submitted', async () => {
      mockApiForgotPassword.mockResolvedValueOnce(undefined);
      render(<ForgotPage />);
      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/email/i), 'user@example.com');
      await user.click(screen.getByRole('button', { name: /send reset link/i }));
      await waitFor(() =>
        expect(screen.getByText(/reset link sent to/i)).toBeInTheDocument(),
      );
    });

    it('shows the submitted email address in the success view', async () => {
      mockApiForgotPassword.mockResolvedValueOnce(undefined);
      render(<ForgotPage />);
      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/email/i), 'yusuf@minirue.com');
      await user.click(screen.getByRole('button', { name: /send reset link/i }));
      await waitFor(() =>
        expect(screen.getByText('yusuf@minirue.com')).toBeInTheDocument(),
      );
    });

    it('success view contains a back-to-sign-in link', async () => {
      mockApiForgotPassword.mockResolvedValueOnce(undefined);
      render(<ForgotPage />);
      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/email/i), 'user@example.com');
      await user.click(screen.getByRole('button', { name: /send reset link/i }));
      await waitFor(() =>
        expect(screen.getByText(/reset link sent to/i)).toBeInTheDocument(),
      );
      expect(screen.getByRole('link', { name: /back to sign in/i })).toHaveAttribute('href', '/login');
    });
  });

  describe('FR-007 — anti-enumeration (error swallowing)', () => {
    it('shows success state even when API throws (error swallowed)', async () => {
      mockApiForgotPassword.mockRejectedValueOnce({ status: 500, message: 'Internal Error' });
      render(<ForgotPage />);
      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/email/i), 'ghost@example.com');
      await user.click(screen.getByRole('button', { name: /send reset link/i }));
      // Must still show success — never reveal whether email exists
      await waitFor(() =>
        expect(screen.getByText(/reset link sent to/i)).toBeInTheDocument(),
      );
    });

    it('does NOT render an error alert after API failure', async () => {
      mockApiForgotPassword.mockRejectedValueOnce({ status: 404, message: 'Not Found' });
      render(<ForgotPage />);
      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/email/i), 'nobody@example.com');
      await user.click(screen.getByRole('button', { name: /send reset link/i }));
      await waitFor(() =>
        expect(screen.getByText(/reset link sent to/i)).toBeInTheDocument(),
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('shows "Sending…" while request in-flight', async () => {
      let resolve!: (_?: unknown) => void;
      mockApiForgotPassword.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
      render(<ForgotPage />);
      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/email/i), 'user@example.com');
      await user.click(screen.getByRole('button', { name: /send reset link/i }));
      expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled();
      resolve();
    });
  });
});
