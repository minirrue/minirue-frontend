/**
 * Unit tests — app/(auth)/signup/page.tsx
 * Covers: render, validation errors, success redirect,
 *         409 conflict, 422 server error, generic error.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));

const mockApiRegister = jest.fn();
jest.mock('@/lib/api/auth', () => ({
  apiRegister: (...args: unknown[]) => mockApiRegister(...args),
}));

jest.mock('@/lib/auth/tokens', () => ({
  setTokens: jest.fn(),
  getAccessToken: jest.fn(() => null),
  getRefreshToken: jest.fn(() => null),
  clearTokens: jest.fn(),
}));

jest.mock('@/lib/session', () => ({
  setSession: jest.fn(),
  getSession: jest.fn(() => null),
  clearSession: jest.fn(),
}));

// ── Component ────────────────────────────────────────────────────────────────
import SignupPage from '@/app/(auth)/signup/page';

// ── Helpers ──────────────────────────────────────────────────────────────────
const mockAuthResponse = () => ({
  accessToken: 'acc-tok',
  refreshToken: 'ref-tok',
  expiresIn: 900,
  tokenType: 'Bearer' as const,
  user: {
    userId: 'u1',
    email: 'new@example.com',
    name: 'New',
    role: 'CUSTOMER',
  },
});

const fillForm = async (
  firstName = 'New',
  email = 'new@example.com',
  password = 'Password1',
  confirmPassword = 'Password1',
) => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/first name/i), firstName);
  await user.type(screen.getByLabelText(/^email$/i), email);
  // There are two password fields; target by label text precisely
  const passwordFields = screen.getAllByLabelText(/password/i);
  await user.type(passwordFields[0], password);
  await user.type(passwordFields[1], confirmPassword);
  await user.click(screen.getByRole('button', { name: /create account/i }));
};

// ── Tests ────────────────────────────────────────────────────────────────────
describe('SignupPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Create account heading', () => {
    render(<SignupPage />);
    expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
  });

  it('renders all four fields', () => {
    render(<SignupPage />);
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    const passwordFields = screen.getAllByLabelText(/password/i);
    expect(passwordFields).toHaveLength(2);
  });

  describe('field validation', () => {
    it('shows first-name required error', async () => {
      render(<SignupPage />);
      const user = userEvent.setup();
      // Submit without filling firstName
      await user.type(screen.getByLabelText(/^email$/i), 'a@b.com');
      const pf = screen.getAllByLabelText(/password/i);
      await user.type(pf[0], 'Password1');
      await user.type(pf[1], 'Password1');
      await user.click(screen.getByRole('button', { name: /create account/i }));
      await waitFor(() =>
        expect(screen.getByText(/first name is required/i)).toBeInTheDocument(),
      );
      expect(mockApiRegister).not.toHaveBeenCalled();
    });

    it('shows invalid email error', async () => {
      render(<SignupPage />);
      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/first name/i), 'Bob');
      await user.type(screen.getByLabelText(/^email$/i), 'not-email');
      const pf = screen.getAllByLabelText(/password/i);
      await user.type(pf[0], 'Password1');
      await user.type(pf[1], 'Password1');
      await user.click(screen.getByRole('button', { name: /create account/i }));
      await waitFor(() =>
        expect(screen.getByText(/valid email/i)).toBeInTheDocument(),
      );
    });

    it('shows password min-length error', async () => {
      render(<SignupPage />);
      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/first name/i), 'Bob');
      await user.type(screen.getByLabelText(/^email$/i), 'bob@example.com');
      const pf = screen.getAllByLabelText(/password/i);
      await user.type(pf[0], 'short');
      await user.type(pf[1], 'short');
      await user.click(screen.getByRole('button', { name: /create account/i }));
      await waitFor(() =>
        expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument(),
      );
    });

    it('shows passwords-do-not-match error', async () => {
      render(<SignupPage />);
      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/first name/i), 'Bob');
      await user.type(screen.getByLabelText(/^email$/i), 'bob@example.com');
      const pf = screen.getAllByLabelText(/password/i);
      await user.type(pf[0], 'Password1');
      await user.type(pf[1], 'Different1');
      await user.click(screen.getByRole('button', { name: /create account/i }));
      await waitFor(() =>
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument(),
      );
    });
  });

  describe('success flow', () => {
    it('calls apiRegister with correct args', async () => {
      mockApiRegister.mockResolvedValueOnce(mockAuthResponse());
      render(<SignupPage />);
      await fillForm();
      await waitFor(() =>
        expect(mockApiRegister).toHaveBeenCalledWith('New', 'new@example.com', 'Password1'),
      );
    });

    it('redirects to / after successful registration', async () => {
      mockApiRegister.mockResolvedValueOnce(mockAuthResponse());
      render(<SignupPage />);
      await fillForm();
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'));
    });

    it('shows loading state while request in-flight', async () => {
      let resolve!: (v: ReturnType<typeof mockAuthResponse>) => void;
      mockApiRegister.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
      render(<SignupPage />);
      await fillForm();
      expect(screen.getByRole('button', { name: /creating account/i })).toBeDisabled();
      resolve(mockAuthResponse());
    });
  });

  describe('API error handling', () => {
    it('shows "already exists" banner on 409', async () => {
      mockApiRegister.mockRejectedValueOnce({ status: 409, message: 'Conflict' });
      render(<SignupPage />);
      await fillForm();
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(/already exists/i),
      );
    });

    it('shows server message on 422', async () => {
      mockApiRegister.mockRejectedValueOnce({ status: 422, message: 'Email format invalid' });
      render(<SignupPage />);
      await fillForm();
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(/email format invalid/i),
      );
    });

    it('shows generic error on 500', async () => {
      mockApiRegister.mockRejectedValueOnce({ status: 500, message: 'Internal Server Error' });
      render(<SignupPage />);
      await fillForm();
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(/something went wrong/i),
      );
    });

    it('shows offline message when status is 0', async () => {
      mockApiRegister.mockRejectedValueOnce({ status: 0, message: 'Network Error' });
      render(<SignupPage />);
      await fillForm();
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(/unable to connect/i),
      );
    });
  });
});
