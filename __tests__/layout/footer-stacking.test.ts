import fs from 'fs';
import path from 'path';

/**
 * The footer paints BELOW the page sheet, and that depends on two files
 * agreeing.
 *
 * ## What went wrong
 *
 * `position: sticky` is a POSITIONED value, so the footer painted in the
 * positioned phase — above every in-flow, non-positioned box on the page,
 * whatever the DOM order. At `z-index: 0` it also tied with `.mr-page-sheet`
 * (positioned, `z-index: auto`) and won the tie on tree order, being the later
 * sibling.
 *
 * So the curtain ran backwards: the sheet is meant to scroll up OVER the footer
 * and reveal it, and instead the footer sat on top of the sheet. Measured on the
 * live site with Playwright, Pixel 5, homepage:
 *
 *     footer   position: sticky   zIndex: 0   top: 30   height: 697
 *     sheet    position: relative zIndex: auto          bottom: 2465
 *
 * A 697px footer pinned across an 851px viewport with 2465px of page still
 * scrolled underneath it. Anything in that band without a z-index of its own was
 * behind the footer and could not be clicked. The header survived only because
 * it carries a higher z-index of its own, which is why this read as "the footer
 * is above the whole site" rather than as a broken header.
 *
 * ## Why the two files are one change
 *
 * Moving the footer to `z-index: -1` alone does not work. A negative-z-index box
 * paints below the backgrounds of in-flow, non-positioned boxes — and `body` is
 * exactly that. An opaque `body` background would hide the footer completely, at
 * every scroll position, on every page: the same bug with the opposite symptom.
 *
 * The ground colour therefore lives on `html`, which is propagated to the canvas
 * and painted below everything, including negative z-indexes. It still covers
 * the route-change gap that the colour was put there for in the first place.
 *
 * Either half alone is broken, and each half looks arbitrary on its own. That is
 * what this file is for: a later tidy-up that "restores" the body background, or
 * that normalises a negative z-index to 0, has to fail here rather than in
 * somebody's browser.
 */

const read = (rel: string) =>
  fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

describe('footer stacking', () => {
  const footer = read('components/layout/Footer.tsx');
  const globals = read('app/globals.css');

  it('gives the footer a negative z-index', () => {
    expect(footer).toMatch(/zIndex:\s*-1/);
  });

  it('does not leave a zero or positive z-index on the footer', () => {
    // The exact value that caused the bug. `sticky` + any non-negative z-index
    // puts the footer above the sheet again.
    expect(footer).not.toMatch(/zIndex:\s*(0|[1-9]\d*)\s*,/);
  });

  it('keeps the footer sticky, because the reveal depends on it', () => {
    /*
     * Not a tidy-up guard — this is the other half of the effect. `fixed` was
     * tried and pinned the footer's top edge above the viewport once its own
     * content grew taller than the screen, so the wordmark was clipped and
     * nothing could scroll to it. See the comment in Footer.tsx.
     */
    expect(footer).toMatch(/position:\s*'sticky'/);
  });

  it('puts the ground colour on html', () => {
    expect(globals).toMatch(/html\s*\{[^}]*background:\s*var\(--mr-cream-200\)/);
  });

  it('does NOT put a background on body', () => {
    /*
     * The half that is easy to "helpfully" restore. An opaque body background
     * paints above a negative-z-index child and hides the footer entirely.
     *
     * Matches the `html, body { ... }` block specifically, since `body` also
     * appears in comments and in unrelated selectors.
     */
    // Line endings are CRLF in this checkout, so match on the selector rather
    // than on an exact newline.
    const start = globals.search(/html,\s*body\s*\{/);
    expect(start).toBeGreaterThan(-1);
    const block = globals.slice(start, globals.indexOf('}', start));
    expect(block).not.toMatch(/background/);
  });

  it('explains why the pair is load-bearing, in both files', () => {
    // Each half is meaningless alone, so each half has to say so where someone
    // editing it will look.
    expect(footer).toMatch(/body/);
    expect(globals).toMatch(/z-index:\s*-1|negative-z-index/);
  });
});
