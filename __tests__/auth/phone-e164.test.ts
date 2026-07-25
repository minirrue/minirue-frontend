import { nationalNumber, phoneProblem, toE164 } from '@/lib/auth/dial-codes';

/**
 * The trunk-zero trap. An Egyptian shopper writes their mobile either way:
 *   01012431350  (with the national trunk zero)
 *   1012431350   (without)
 * Both are the same number and both must be stored as +201012431350. Joining the
 * dial code to the raw input would store the first as +2001012431350, which no
 * courier can call and nothing downstream would flag.
 */
describe('phone normalisation to E.164', () => {
  it('treats a leading zero and no leading zero as the same Egyptian number', () => {
    expect(toE164('+20', '01012431350')).toBe('+201012431350');
    expect(toE164('+20', '1012431350')).toBe('+201012431350');
  });

  it('never double-prefixes the dial code', () => {
    expect(toE164('+20', '+201012431350')).toBe('+201012431350');
    expect(toE164('+20', '201012431350')).toBe('+201012431350');
    expect(toE164('+20', '00201012431350')).toBe('+201012431350');
  });

  it('ignores the spaces, dashes and brackets people type', () => {
    expect(toE164('+20', '010 1243 1350')).toBe('+201012431350');
    expect(toE164('+20', '010-1243-1350')).toBe('+201012431350');
    expect(toE164('+44', '(0) 7700 900123')).toBe('+447700900123');
  });

  it('keeps a national number that merely starts with the dial digits', () => {
    // Saudi +966, national number 501234567 — the leading digits are not a
    // repeated dial code and must survive.
    expect(nationalNumber('+966', '0501234567')).toBe('501234567');
    expect(toE164('+966', '0501234567')).toBe('+966501234567');
  });

  describe('length is checked against the chosen country', () => {
    it('accepts a correct number', () => {
      expect(phoneProblem('+20', '01012431350')).toBeNull();
      expect(phoneProblem('+20', '1012431350')).toBeNull();
      expect(phoneProblem('+966', '0501234567')).toBeNull();
    });

    it('rejects one digit too few or too many', () => {
      expect(phoneProblem('+20', '0101243135')).toMatch(/10 digits/);
      expect(phoneProblem('+20', '010124313501')).toMatch(/10 digits/);
    });

    it('rejects an Egyptian-length number under a Saudi dial code', () => {
      // 10 digits is right for Egypt and wrong for Saudi Arabia — the country
      // the shopper selected is what decides.
      expect(phoneProblem('+966', '1012431350')).toMatch(/9 digits/);
    });

    it('requires a number at all', () => {
      expect(phoneProblem('+20', '')).toMatch(/required/i);
      expect(phoneProblem('+20', '0')).toMatch(/required/i);
    });
  });
});
