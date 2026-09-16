import {
  GOVERNORATE_KEYS,
  GOVERNORATES,
  isGovernorateKey,
  normaliseGovernorateText,
  resolveGovernorateKey,
  governorateLabel,
} from '@/lib/checkout/governorates';
import fixture from '@/lib/checkout/fixtures/governorates.fixture.json';

/**
 * frontend#158 — the closed governorate list, mirrored from the backend's
 * `src/common/geo/governorates.ts`. `governorates.fixture.json` is a
 * committed copy of the backend's own fixture export (backend#186); this
 * file pins the two together the same way `governorate-rates.test.ts` pins
 * `governorate-rates.ts` against the backend's `shipping-policy.ts`.
 */

describe('GOVERNORATES parity with the backend fixture', () => {
  it('has exactly 27 keys', () => {
    expect(GOVERNORATE_KEYS).toHaveLength(27);
    expect(GOVERNORATES).toHaveLength(27);
  });

  it('matches the backend fixture byte-for-byte, in order', () => {
    expect(GOVERNORATES).toEqual(fixture);
  });

  it('has a unique key per entry', () => {
    const keys = GOVERNORATES.map((g) => g.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every entry has non-empty en and ar labels', () => {
    for (const g of GOVERNORATES) {
      expect(g.en.trim().length).toBeGreaterThan(0);
      expect(g.ar.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('isGovernorateKey', () => {
  it('accepts a real key', () => {
    expect(isGovernorateKey('CAIRO')).toBe(true);
  });

  it('rejects free text and non-strings', () => {
    expect(isGovernorateKey('Cairo')).toBe(false);
    expect(isGovernorateKey('')).toBe(false);
    expect(isGovernorateKey(null)).toBe(false);
    expect(isGovernorateKey(undefined)).toBe(false);
    expect(isGovernorateKey(42)).toBe(false);
  });
});

describe('resolveGovernorateKey', () => {
  it('passes through a real key', () => {
    expect(resolveGovernorateKey('GIZA')).toBe('GIZA');
  });

  it.each([
    ['Cairo', 'CAIRO'],
    ['cairo', 'CAIRO'],
    ['CAIRO GOVERNORATE', 'CAIRO'],
    ['Cairo Governorate', 'CAIRO'],
    ['القاهرة', 'CAIRO'],
    ['القاهره', 'CAIRO'],
    ['محافظة القاهرة', 'CAIRO'],
    ['Giza', 'GIZA'],
    ['الجيزة', 'GIZA'],
    ['Alexandria', 'ALEXANDRIA'],
    ['Kafr El Sheikh', 'KAFR_EL_SHEIKH'],
    ['kafr el-sheikh', 'KAFR_EL_SHEIKH'],
    ['New Valley', 'NEW_VALLEY'],
    ['Port Said', 'PORT_SAID'],
  ])('maps free text %s to %s', (text, key) => {
    expect(resolveGovernorateKey(text)).toBe(key);
  });

  it('returns null for text matching no governorate', () => {
    expect(resolveGovernorateKey('Neverland')).toBeNull();
    expect(resolveGovernorateKey('—')).toBeNull();
    expect(resolveGovernorateKey('')).toBeNull();
    expect(resolveGovernorateKey(null)).toBeNull();
    expect(resolveGovernorateKey(undefined)).toBeNull();
  });
});

describe('normaliseGovernorateText', () => {
  it('folds Arabic orthography variants together', () => {
    expect(normaliseGovernorateText('القاهرة')).toBe(
      normaliseGovernorateText('القاهره'),
    );
  });

  it('returns null for non-strings and placeholder punctuation', () => {
    expect(normaliseGovernorateText(123)).toBeNull();
    expect(normaliseGovernorateText('—')).toBeNull();
  });
});

describe('governorateLabel', () => {
  it('returns the English label by default', () => {
    expect(governorateLabel('CAIRO')).toBe('Cairo');
  });

  it('returns the Arabic label when asked', () => {
    expect(governorateLabel('CAIRO', 'ar')).toBe('القاهرة');
  });
});
