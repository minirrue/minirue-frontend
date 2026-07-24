/**
 * Unit tests — lib/auth/tokens.ts
 * Covers: isAuthenticated, markAuthenticated, clearAuthFlag
 *
 * Auth tokens now live in httpOnly cookies set by the backend and are NOT
 * readable from JS, so these tests only cover the client-visible "logged in"
 * hint cookie (mr-auth), not the tokens themselves.
 */

import {
  isAuthenticated,
  markAuthenticated,
  clearAuthFlag,
} from '@/lib/auth/tokens';

const COOKIE_NAME = 'mr-auth';

describe('lib/auth/tokens', () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = `${COOKIE_NAME}=; Max-Age=0; path=/`;
  });

  describe('isAuthenticated', () => {
    it('returns false when no hint cookie is set', () => {
      expect(isAuthenticated()).toBe(false);
    });

    it('returns true once the hint cookie is set', () => {
      markAuthenticated();
      expect(isAuthenticated()).toBe(true);
    });
  });

  describe('markAuthenticated', () => {
    it('sets the mr-auth hint cookie', () => {
      markAuthenticated();
      expect(document.cookie).toContain(`${COOKIE_NAME}=1`);
    });

    it('never writes tokens to localStorage', () => {
      markAuthenticated();
      expect(localStorage.getItem('mr-access-token')).toBeNull();
      expect(localStorage.getItem('mr-refresh-token')).toBeNull();
    });
  });

  describe('clearAuthFlag', () => {
    it('expires the mr-auth hint cookie', () => {
      markAuthenticated();
      clearAuthFlag();
      expect(document.cookie).not.toContain(`${COOKIE_NAME}=1`);
    });

    it('is idempotent — safe to call when nothing is set', () => {
      expect(() => clearAuthFlag()).not.toThrow();
    });
  });

  describe('round-trip', () => {
    it('mark then clear leaves the user logged out', () => {
      markAuthenticated();
      expect(isAuthenticated()).toBe(true);
      clearAuthFlag();
      expect(isAuthenticated()).toBe(false);
    });
  });
});
