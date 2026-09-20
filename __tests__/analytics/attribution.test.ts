/**
 * Unit tests — lib/analytics/attribution.ts
 * Covers the client-side rescue path (backend#224 / frontend#188):
 * mr-vid-c -> localStorage sync, and the x-mr-vid header fallback derived
 * from cookie first, then localStorage, and never minted client-side.
 */
import {
  attributionHeaders,
  getVisitorIdForHeader,
  syncVisitorIdMirror,
} from '@/lib/analytics/attribution';

const VALID_UUID = 'b6f1c3f0-9a3b-4e3a-9a6c-1a2b3c4d5e6f';
const OTHER_VALID_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function setCookie(value: string): void {
  document.cookie = value;
}

function clearAllCookies(): void {
  for (const name of ['mr-vid-c', 'mr-attr-pub']) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

describe('lib/analytics/attribution', () => {
  afterEach(() => {
    clearAllCookies();
    window.localStorage.clear();
  });

  describe('syncVisitorIdMirror', () => {
    it('copies a valid mr-vid-c cookie into localStorage', () => {
      setCookie(`mr-vid-c=${VALID_UUID}`);
      syncVisitorIdMirror();
      expect(window.localStorage.getItem('mr-vid')).toBe(VALID_UUID);
    });

    it('does not write to localStorage when the cookie is absent', () => {
      syncVisitorIdMirror();
      expect(window.localStorage.getItem('mr-vid')).toBeNull();
    });

    it('never invents an id when the cookie is malformed', () => {
      setCookie('mr-vid-c=not-a-uuid');
      syncVisitorIdMirror();
      expect(window.localStorage.getItem('mr-vid')).toBeNull();
    });
  });

  describe('getVisitorIdForHeader', () => {
    it('prefers the readable mirror cookie when present', () => {
      setCookie(`mr-vid-c=${VALID_UUID}`);
      window.localStorage.setItem('mr-vid', OTHER_VALID_UUID);
      expect(getVisitorIdForHeader()).toBe(VALID_UUID);
    });

    it('falls back to localStorage when no cookie is readable (cleared cookies, kept site data)', () => {
      window.localStorage.setItem('mr-vid', VALID_UUID);
      expect(getVisitorIdForHeader()).toBe(VALID_UUID);
    });

    it('returns undefined for a genuinely fresh browser — never mints client-side', () => {
      expect(getVisitorIdForHeader()).toBeUndefined();
    });

    it('ignores a malformed localStorage value rather than sending it', () => {
      window.localStorage.setItem('mr-vid', 'not-a-uuid');
      expect(getVisitorIdForHeader()).toBeUndefined();
    });
  });

  describe('attributionHeaders', () => {
    it('includes x-mr-vid from the mirror cookie', () => {
      setCookie(`mr-vid-c=${VALID_UUID}`);
      expect(attributionHeaders()['x-mr-vid']).toBe(VALID_UUID);
    });

    it('includes x-mr-vid from localStorage when cookies are gone', () => {
      window.localStorage.setItem('mr-vid', VALID_UUID);
      expect(attributionHeaders()['x-mr-vid']).toBe(VALID_UUID);
    });

    it('omits x-mr-vid entirely for a fresh browser', () => {
      expect(attributionHeaders()['x-mr-vid']).toBeUndefined();
    });
  });
});
