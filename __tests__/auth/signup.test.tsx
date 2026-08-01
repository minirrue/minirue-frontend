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
  // replace, not push: a completed sign-up must not leave the form in the
  // back-stack for a shopper who now has a session.
  useRouter: () => ({ push: jest.fn(), replace: mockPush }),
  useSearchParams: () => ({ get: () => null }),
}));

const mockApiRegister = jest.fn();
jest.mock('@/lib/api/auth', () => ({
  apiRegister: (...args: unknown[]) => mockApiRegister(...args),
}));

jest.mock('@/lib/auth/tokens', () => ({
  markAuthenticated: jest.fn(),
  isAuthenticated: jest.fn(() => false),
  clearAuthFlag: jest.fn(),
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
  lastName = 'Customer',
  phoneNumber = '01001234567',
) => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/first name/i), firstName);
  await user.type(screen.getByLabelText(/last name/i), lastName);
  await user.type(screen.getByLabelText(/^email$/i), email);
  await user.type(screen.getByLabelText(/phone number/i), phoneNumber);
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

  it('renders every field', () => {
    render(<SignupPage />);
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/country/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
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
        // The dial code defaults to Egypt and the local number's leading zero is
        // dropped, so 01001234567 must reach the API as +201001234567.
        expect(mockApiRegister).toHaveBeenCalledWith({
          firstName: 'New',
          lastName: 'Customer',
          email: 'new@example.com',
          password: 'Password1',
          phone: '+201001234567',
        }),
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

  // ── Country/phone row layout ──────────────────────────────────────────────
  // Regression guard for a defect the owner reported more than once: the
  // country dial-code select is the SHORT field and must stay a small fixed
  // basis; the phone number is the LONG field and must flex to fill the rest
  // of the row. A flex child left at the browser default `min-width: auto`
  // refuses to shrink below its own content width and shoves its neighbour
  // out of the row — that is the actual mechanism behind "they collide and
  // aren't on the same line," not a font-size or overflow issue, so it must
  // never be "fixed" by shrinking text or adding scroll/clip.
  describe('country/phone row', () => {
    it('keeps the country field a fixed narrow basis and lets the phone field flex', () => {
      render(<SignupPage />);

      const row = screen.getByTestId('phone-country-row');
      const countryField = screen.getByTestId('phone-country-field');
      const phoneField = screen.getByTestId('phone-number-field');

      // Country: short content, fixed basis, cannot grow or shrink away from it.
      expect(countryField.style.flex).toBe('0 0 132px');

      // Phone: takes the remaining space...
      expect(phoneField.style.flex).toMatch(/^1 1 /);
      // ...and is NOT left at the default content-based min-width, which is
      // the one-line regression that reintroduces the collision.
      expect(phoneField.style.minWidth).toBe('0');
      expect(countryField.style.minWidth).toBe('0');

      // The row must wrap cleanly rather than overlap if a viewport is ever
      // too narrow to hold both fields side by side.
      expect(row.style.flexWrap).toBe('wrap');
    });
  });

  // ── Focus after redirect ───────────────────────────────────────────────────
  // Regression guard for a second defect: after a successful signup, the
  // shopper is redirected to the home page, which has no input at all. If the
  // last-focused field (often confirm-password) is still focused when its
  // page unmounts, mobile browsers can leave the on-screen keyboard open on
  // the page that follows. The fix blurs the active element before navigating.
  //
  // Clicking the submit button legitimately moves focus to it (a <button>
  // does not summon a keyboard, so that alone is not the bug) — what matters
  // is that the field the shopper was actually typing into a moment earlier
  // no longer holds it.
  describe('focus after redirect', () => {
    it('blurs the last-typed-into field before the post-signup redirect fires', async () => {
      mockApiRegister.mockResolvedValueOnce(mockAuthResponse());
      render(<SignupPage />);
      const confirmPasswordField = screen.getAllByLabelText(/password/i)[1];

      await fillForm();

      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'));

      expect(document.activeElement).not.toBe(confirmPasswordField);
      // Nothing text-editable should hold focus at all — only a non-keyboard
      // element (the submit button) or the document body may.
      expect(['INPUT', 'TEXTAREA', 'SELECT']).not.toContain(document.activeElement?.tagName);
    });
  });
});
