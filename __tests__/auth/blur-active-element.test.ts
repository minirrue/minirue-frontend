import { blurActiveElement } from '@/lib/auth/blur-active-element';

describe('blurActiveElement', () => {
  it('blurs whatever element currently holds focus', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    expect(document.activeElement).toBe(input);

    blurActiveElement();

    expect(document.activeElement).not.toBe(input);
    expect(document.activeElement).toBe(document.body);

    document.body.removeChild(input);
  });

  it('is a no-op when nothing is focused', () => {
    expect(document.activeElement).toBe(document.body);
    expect(() => blurActiveElement()).not.toThrow();
    expect(document.activeElement).toBe(document.body);
  });
});
