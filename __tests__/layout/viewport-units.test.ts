import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The "page expands as you scroll" bug, on mobile only (reported 2026-08-23).
 *
 *   vh  = LARGE viewport (browser chrome hidden). Constant.
 *   svh = SMALL viewport (browser chrome shown).  Constant.
 *   dvh = DYNAMIC. Re-resolves live as the URL bar collapses on scroll.
 *
 * `dvh` is the only one that changes mid-scroll. On a FIXED overlay that is
 * exactly what you want — the sheet tracks the visible area and adds no page
 * height. On an IN-FLOW element it is the bug: the element grows as the
 * toolbar hides, and the page grows with it.
 *
 * This is a source-text assertion rather than a rendered one on purpose.
 * jsdom has no viewport chrome, so no amount of rendering can tell svh from
 * dvh at runtime — the only place the distinction is observable is the source.
 * It exists because this was already fixed in the WRONG direction once (vh ->
 * dvh, on the belief that dvh was the stable unit), and the comment explaining
 * the swap made the mistake look deliberate.
 */

const ROOT = join(__dirname, '..', '..');

/** In-flow surfaces: their height IS page height, so they must never use dvh. */
const IN_FLOW_SOURCES = [
  'components/storefront/Hero.tsx',
  'components/auth/AuthShell.tsx',
  'app/styles/mr-tokens.css',
  'app/error.tsx',
  'app/not-found.tsx',
  'app/account/AccountLayoutClient.tsx',
];

describe('viewport units on in-flow layout', () => {
  it.each(IN_FLOW_SOURCES)(
    '%s sizes itself with a stable viewport unit, never dvh',
    (relPath) => {
      const source = readFileSync(join(ROOT, relPath), 'utf8');
      // Strip comments — they discuss dvh deliberately, and explaining the
      // trap must not be what trips the test.
      const code = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      expect(code).not.toMatch(/\ddvh/);
    },
  );

  it('the hero uses svh so it cannot resize as mobile chrome collapses', () => {
    // Asserts the RULE, not the expression.
    //
    // This used to pin the literal `mobile ? '80svh' : 'min(100svh, 980px)'`,
    // so changing the hero to fill the viewport — the same svh, different
    // arithmetic — failed a test whose name is about the unit. A guard that
    // breaks on any edit to the line it guards stops being read as a warning.
    const hero = readFileSync(
      join(ROOT, 'components/storefront/Hero.tsx'),
      'utf8',
    );
    const code = hero
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    expect(code).toMatch(/height: .*svh/);
    expect(code).not.toMatch(/\ddvh/);
  });

  it('the hero fills the viewport, minus whatever shares the first screen', () => {
    // The owner's report was seeing "the website under the hero" on first load:
    // the hero was 80svh on mobile and capped at 980px on desktop, so the next
    // section showed above the fold. It now takes the whole viewport less
    // `belowOffset` — the ribbon's height when one follows it, zero otherwise —
    // so the first screen is the hero, or the hero and its ribbon.
    const hero = readFileSync(
      join(ROOT, 'components/storefront/Hero.tsx'),
      'utf8',
    );

    expect(hero).toMatch(/calc\(100svh - \$\{belowOffset\}px\)/);
  });
});
