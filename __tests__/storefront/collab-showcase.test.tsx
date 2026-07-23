import { stepIndex } from '@/components/storefront/CollabShowcase';

describe('stepIndex', () => {
  it('wraps forward past the end', () => {
    expect(stepIndex(2, 1, 3)).toBe(0);
  });

  it('wraps backward past the start', () => {
    expect(stepIndex(0, -1, 3)).toBe(2);
  });

  it('steps normally in the middle', () => {
    expect(stepIndex(1, 1, 3)).toBe(2);
    expect(stepIndex(1, -1, 3)).toBe(0);
  });

  it('stays put with a single tab', () => {
    expect(stepIndex(0, 1, 1)).toBe(0);
  });
});
