import fs from 'fs';
import path from 'path';

/**
 * The footer reveal ("the outer reveal under the webpage"), and the three ways
 * it was got wrong before this.
 *
 * ## What the effect needs
 *
 * The page has to slide up and off the footer. That means the footer must be
 * PAINTED somewhere other than where it sits in flow — only `fixed`/`sticky`
 * can do that — and it must paint UNDER `.mr-page-sheet`, which is itself
 * `position: relative`. Two positioned boxes, so something has to order them.
 *
 * ## The three attempts, all of which ordered them with a number
 *
 * **`fixed; bottom: 0`** — the original. Rendered after the sheet, so it
 * painted over the page; and once the footer's own content grew taller than the
 * viewport its top edge was pinned off screen, the wordmark was clipped, and
 * nothing could scroll to it. It also needed a `ResizeObserver` writing
 * `document.body.style.paddingBottom` to fake in-flow height.
 *
 * **`sticky; bottom: 0; z-index: 0`** — measured on the live site, Pixel 5,
 * homepage:
 *
 *     footer   position: sticky    zIndex: 0     top: 30   height: 697
 *     sheet    position: relative  zIndex: auto            bottom: 2465
 *
 * A 697px footer pinned across an 851px viewport with 2465px of page still
 * scrolling underneath it. `sticky` is a POSITIONED value, so the footer
 * painted above every in-flow box whatever the DOM order, and at `z-index: 0`
 * it tied with the sheet and won the tie on tree order, being the later
 * sibling. The curtain ran backwards.
 *
 * **`sticky; z-index: -1`** — corrected the painting and broke hit testing with
 * it: a negative-z-index box sits behind in-flow content for POINTER EVENTS
 * too. The footer rendered perfectly and every link in it was dead. Caught by
 * clicking "About" at its own coordinates on the deployed site and watching the
 * URL not change.
 *
 * ## The invariant this file now enforces
 *
 * The ordering is won on DOCUMENT ORDER, not on a z-index. The curtain wrapper
 * (`.mr-footer-curtain`, which holds the Ebneely signature and `<footer>`) is
 * the positioned box, it is rendered BEFORE `.mr-page-sheet` at every call site
 * (audited in footer.test.tsx), and neither box declares a z-index — so neither
 * creates a stacking context, nothing anywhere else in the app changes rank,
 * and nothing is negative, so hit testing is ordinary.
 *
 * So: `<footer>` itself stays an unpositioned box with no z-index and no
 * insets — every failure above put those properties there — and the two
 * positions the curtain is allowed are `fixed` (the reveal) and `absolute`
 * (the fallback for a footer taller than the viewport, which is reached by
 * scrolling rather than pinned).
 */

const read = (rel: string) =>
  fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

describe('footer stacking', () => {
  const footer = read('components/layout/Footer.tsx');

  /** The inline style object on the `<footer>` element, not the whole file, and
   *  with its comments stripped — the comment explaining why there is no
   *  `position` and no `zIndex` necessarily names both, and matching that would
   *  be matching the explanation rather than the declarations. */
  const footerStyle = (() => {
    const anchor = footer.indexOf('data-mr-surface="ink"');
    expect(anchor).toBeGreaterThan(-1);
    return footer
      .slice(anchor, footer.indexOf('>', footer.indexOf('}}', anchor)))
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
  })();

  it('does not position the <footer> element itself', () => {
    // The curtain WRAPPER is what is positioned. Every attempt that put
    // `position` here then had to pick a z-index to settle the fight with the
    // page sheet, and both possible answers were bugs.
    expect(footerStyle).not.toMatch(/position:\s*['"](sticky|fixed|absolute)['"]/);
  });

  it('declares no z-index at all', () => {
    /*
     * Not "no positive z-index" — none. 0 put the footer above the page and -1
     * made its links unclickable. Document order needs neither.
     */
    expect(footerStyle).not.toMatch(/zIndex/);
  });

  it('sets no inset properties, which only mean something when positioned', () => {
    expect(footerStyle).not.toMatch(/\b(top|bottom|left|right):\s*0/);
  });

  it('records why, so the reveal is not re-attempted the same way', () => {
    // All three failures are named in the file. A future edit needs to know
    // that these exact approaches were measured and what each one broke.
    expect(footer).toMatch(/sticky/);
    expect(footer).toMatch(/hit test|hit testing|dead/i);
  });
});

describe('the curtain wrapper', () => {
  const footer = read('components/layout/Footer.tsx');
  const tokens = read('app/styles/mr-tokens.css');
  const globals = read('app/globals.css');

  /** `.mr-footer-curtain`'s DECLARATIONS. Comments are stripped from the whole
   *  sheet first, not from the matched rules: the prose above these rules (and
   *  above `.mr-page-sheet`) names the class and the properties it deliberately
   *  does not set, and matching that would be matching the explanation. */
  const curtainRules = (() => {
    const css = tokens.replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = [...css.matchAll(/\.mr-footer-curtain[^{]*\{[^}]*\}/g)].map((m) => m[0]);
    expect(rules.length).toBeGreaterThan(0);
    return rules.join('\n');
  })();

  it('wraps the footer in a positioned element, so the reveal exists at all', () => {
    // An unpositioned box overlaps nothing, so it can be revealed from under
    // nothing. This is the property the static-flow footer traded the effect
    // away for, and it is what the owner reported missing.
    expect(footer).toMatch(/className="mr-footer-curtain"/);
    expect(curtainRules).toMatch(/position:\s*fixed/);
  });

  it('has no z-index either — the sheet is ordered above it by document order', () => {
    // The whole point. A z-index here (or on `.mr-page-sheet`) creates a
    // stacking context and seals every overlay mounted inside it; see
    // page-sheet-stacking.test.ts for the bug that caused last time.
    expect(curtainRules).not.toMatch(/z-index/);
  });

  it('offers a non-pinned fallback for a footer taller than the viewport', () => {
    // A bottom-pinned box taller than the scrollport can never show its own
    // top — that is failure (1), and extra scroll room does not fix it. The
    // fallback puts the curtain at the true bottom of the document instead,
    // where every pixel of it can be scrolled to.
    expect(curtainRules).toMatch(/position:\s*absolute/);
    expect(footer).toMatch(/data-curtain=\{pinned \? 'pinned' : 'flow'\}/);
    expect(footer).toMatch(/window\.innerHeight/);
  });

  it('reserves its scroll room through a CSS variable, not an inline body style', () => {
    // The deleted effect wrote `document.body.style.paddingBottom` directly on
    // every resize. The measurement is still needed — without reserved room
    // below the sheet there is nothing for the sheet's bottom edge to travel
    // into and nothing gets revealed — but it travels as one custom property.
    expect(footer).toMatch(/--mr-footer-h/);
    // An assignment, not the mention of it — Footer.tsx names the deleted
    // effect in prose precisely so it is not reinvented.
    expect(footer).not.toMatch(/body\.style\.paddingBottom\s*=/);
    expect(globals).toMatch(/padding-bottom:\s*var\(--mr-footer-h/);
    // The fallback is absolute against `body`, so `body` has to be its
    // containing block or "the bottom" means the viewport, not the document.
    expect(globals).toMatch(/position:\s*relative/);
  });
});
