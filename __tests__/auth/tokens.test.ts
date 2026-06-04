/**
 * Unit tests — lib/auth/tokens.ts
 * Covers: getAccessToken, getRefreshToken, setTokens, clearTokens
 */

import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
} from '@/lib/auth/tokens';

const ACCESS_KEY = 'mr-access-token';
const REFRESH_KEY = 'mr-refresh-token';
const COOKIE_NAME = 'mr-auth';

describe('lib/auth/tokens', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset cookies
    document.cookie = `${COOKIE_NAME}=; Max-Age=0; path=/`;
  });

  describe('getAccessToken', () => {
    it('returns null when nothing stored', () => {
      expect(getAccessToken()).toBeNull();
    });

    it('returns stored access token', () => {
      localStorage.setItem(ACCESS_KEY, 'tok-access-123');
      expect(getAccessToken()).toBe('tok-access-123');
    });
  });

  describe('getRefreshToken', () => {
    it('returns null when nothing stored', () => {
      expect(getRefreshToken()).toBeNull();
    });

    it('returns stored refresh token', () => {
      localStorage.setItem(REFRESH_KEY, 'tok-refresh-456');
      expect(getRefreshToken()).toBe('tok-refresh-456');
    });
  });

  describe('setTokens', () => {
    it('persists both tokens to localStorage', () => {
      setTokens('acc-abc', 'ref-xyz');
      expect(localStorage.getItem(ACCESS_KEY)).toBe('acc-abc');
      expect(localStorage.getItem(REFRESH_KEY)).toBe('ref-xyz');
    });

    it('sets mr-auth cookie', () => {
      setTokens('acc-abc', 'ref-xyz');
      expect(document.cookie).toContain(`${COOKIE_NAME}=1`);
    });

    it('overwrites previously stored tokens', () => {
      setTokens('old-acc', 'old-ref');
      setTokens('new-acc', 'new-ref');
      expect(localStorage.getItem(ACCESS_KEY)).toBe('new-acc');
      expect(localStorage.getItem(REFRESH_KEY)).toBe('new-ref');
    });
  });

  describe('clearTokens', () => {
    it('removes both tokens from localStorage', () => {
      setTokens('acc', 'ref');
      clearTokens();
      expect(localStorage.getItem(ACCESS_KEY)).toBeNull();
      expect(localStorage.getItem(REFRESH_KEY)).toBeNull();
    });

    it('expires the mr-auth cookie', () => {
      setTokens('acc', 'ref');
      clearTokens();
      // After Max-Age=0 the cookie value becomes empty / absent in jsdom
      expect(document.cookie).not.toContain(`${COOKIE_NAME}=1`);
    });

    it('is idempotent — safe to call when nothing stored', () => {
      expect(() => clearTokens()).not.toThrow();
    });
  });

  describe('round-trip', () => {
    it('set then get returns same values', () => {
      setTokens('round-acc', 'round-ref');
      expect(getAccessToken()).toBe('round-acc');
      expect(getRefreshToken()).toBe('round-ref');
    });

    it('set then clear then get returns null', () => {
      setTokens('acc', 'ref');
      clearTokens();
      expect(getAccessToken()).toBeNull();
      expect(getRefreshToken()).toBeNull();
    });
  });
});
