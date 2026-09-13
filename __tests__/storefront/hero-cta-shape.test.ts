import fs from 'fs';
import path from 'path';

/**
 * The hero CTA is the house button's shape, and a swept button never hides its
 * own label (frontend#79).
 *
 * Measured in real Chrome after this change: the hero "Shop the edit" pill, the
 * account "Sign out" Button (outline, sm) and chat's "Start conversation"
 * Button (primary, sm) are all 47px tall, 17px/18px padding, Jost 11px weight
 * 400, 2.42px tracking, 999px radius, 1px border. `.mr-hero-cta` is plain CSS
 * (it is rendered inside server components and editor-driven markup), so these
 * values are copied from Button.tsx — this test is what keeps the copy honest.
 */

const root = path.join(__dirname, '..', '..');
const css = fs.readFileSync(path.join(root, 'app', 'styles', 'mr-tokens.css'), 'utf8');
const button = fs.readFileSync(path.join(root, 'components', 'ui', 'Button.tsx'), 'utf8');

/** The first `.mr-hero-cta { … }` block — the one that owns the geometry. */
function heroCtaBlock(): Record<string, string> {
  const match = css.match(/^\.mr-hero-cta \{([\s\S]*?)^\}/m);
  if (!match) throw new Error('.mr-hero-cta block not found in mr-tokens.css');
  const decls: Record<string, string> = {};
  for (const line of match[1].split(';')) {
    const [prop, ...rest] = line.split(':');
    if (prop && rest.length) decls[prop.trim()] = rest.join(':').trim();
  }
  return decls;
}

describe('hero CTA shape matches <Button size="sm">', () => {
  const hero = heroCtaBlock();

  it('uses the sm padding, type and tracking Button uses', () => {
    expect(button).toContain(`padding: size === 'sm' ? '17px 18px'`);
    expect(hero.padding).toBe('17px 18px');

    expect(button).toContain(`fontSize: size === 'sm' ? 11`);
    expect(hero['font-size']).toBe('11px');

    expect(button).toContain(`letterSpacing: '0.22em'`);
    expect(hero['letter-spacing']).toBe('0.22em');

    expect(button).toContain(`fontFamily: 'Jost, sans-serif'`);
    expect(hero['font-family']).toBe('Jost, sans-serif');

    expect(hero['font-weight']).toBe('400');
    expect(hero.gap).toBe('10px');
    expect(hero['line-height']).toBe('1');
  });

  it('is a pill with a 1px border, like Button', () => {
    expect(button).toContain(`'var(--mr-radius-pill)'`);
    expect(hero['border-radius']).toBe('var(--mr-radius-pill)');
    expect(button).toContain(`border: '1px solid transparent'`);
    expect(hero.border).toMatch(/^1px solid /);
  });
});

describe('sweep buttons keep a readable label', () => {
  it('runs the panel and the label colour on the same enabled-only hover', () => {
    const enabledHover = '.mr-btn-sweep:hover:not(:disabled):not([aria-disabled="true"])';
    expect(css).toContain(`${enabledHover}::before`);
    expect(css).toContain(`${enabledHover} { color: var(--sweep-ink`);
    // A bare `:hover` panel sweeps a disabled button under the pointer while
    // Button's JS keeps its resting colour: cream on cream, contrast 1.0.
    expect(css).not.toMatch(/\.mr-btn-sweep:hover::before/);
  });

  it('gives every swept Button the ink the stylesheet flips to', () => {
    expect(button).toMatch(/'--sweep-ink':/);
  });
});
