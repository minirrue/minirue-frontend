import {
  BOOTH_SIGNUP_PREFILL_TTL_MS,
  boothReviewTokenFromReturnPath,
  saveBoothSignupPrefill,
  takeBoothSignupPrefill,
} from '@/lib/api/ground-review';

const token = 'a'.repeat(64);
const next = `/booth/review/${token}`;
const contact = {
  firstName: 'Mona',
  lastName: 'Ali',
  phone: '+201001234567',
  email: 'mona@example.com',
};

describe('booth signup prefill transfer', () => {
  beforeEach(() => {
    sessionStorage.clear();
    jest.restoreAllMocks();
  });

  it('is one-shot, includes only captured contact fields, and is bound to the exact review return path', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000);

    saveBoothSignupPrefill({ ...contact, next });

    const stored = sessionStorage.getItem('mr.boothSignupPrefill.v1');
    expect(stored).toContain('mona@example.com');
    expect(stored).not.toMatch(/password/i);
    expect(takeBoothSignupPrefill(`/booth/review/${'b'.repeat(64)}`)).toBeNull();
    expect(takeBoothSignupPrefill(next)).toBeNull();

    saveBoothSignupPrefill({ ...contact, next });
    expect(takeBoothSignupPrefill(next)).toEqual({ ...contact, next });
    expect(takeBoothSignupPrefill(next)).toBeNull();
  });

  it('rejects expired, malformed, and non-review records without exposing them to another navigation', () => {
    jest.spyOn(Date, 'now').mockReturnValue(2_000);
    saveBoothSignupPrefill({ ...contact, next });
    jest.spyOn(Date, 'now').mockReturnValue(2_000 + BOOTH_SIGNUP_PREFILL_TTL_MS + 1);
    expect(takeBoothSignupPrefill(next)).toBeNull();

    sessionStorage.setItem('mr.boothSignupPrefill.v1', '{broken');
    expect(takeBoothSignupPrefill(next)).toBeNull();

    saveBoothSignupPrefill({ ...contact, next: 'https://evil.example/signup' });
    expect(sessionStorage.getItem('mr.boothSignupPrefill.v1')).toBeNull();
  });

  it('fails closed and never throws when sessionStorage access is denied', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(() => saveBoothSignupPrefill({ ...contact, next })).not.toThrow();
    jest.restoreAllMocks();

    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(() => takeBoothSignupPrefill(next)).not.toThrow();
    expect(takeBoothSignupPrefill(next)).toBeNull();
  });

  it('extracts a token only from an exact validated local review path', () => {
    expect(boothReviewTokenFromReturnPath(next)).toBe(token);
    expect(boothReviewTokenFromReturnPath(`//evil.example/booth/review/${token}`)).toBeNull();
    expect(boothReviewTokenFromReturnPath(`/booth/review/${token}/extra`)).toBeNull();
    expect(boothReviewTokenFromReturnPath('/booth/review/not-a-token')).toBeNull();
  });
});
