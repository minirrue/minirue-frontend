import fs from 'fs';
import path from 'path';

/**
 * The footer is a plain block in normal flow. It must not be positioned, and it
 * must not carry a z-index.
 *
 * ## Two ways this was got wrong, in one afternoon
 *
 * **`position: sticky; z-index: 0`** — what shipped originally. `sticky` is a
 * POSITIONED value, so the footer painted in the positioned phase, above every
 * in-flow non-positioned box whatever the DOM order; at `z-index: 0` it also
 * tied with `.mr-page-sheet` (positioned, `z-index: auto`) and won on tree
 * order, being the later sibling. Measured on the live site, Pixel 5, homepage:
 *
 *     footer   position: sticky    zIndex: 0     top: 30   height: 697
 *     sheet    position: relative  zIndex: auto            bottom: 2465
 *
 * A 697px footer pinned across an 851px viewport with 2465px of page still
 * scrolled underneath it. The curtain ran backwards — the sheet is meant to
 * scroll up OVER the footer, and instead the footer covered the sheet.
 *
 * **`position: sticky; z-index: -1`** — the attempted fix, and worse. It
 * corrected the painting and broke hit testing with it: a negative-z-index box
 * sits behind in-flow content for pointer events too. The footer rendered
 * perfectly and every link in it was dead. Caught by clicking "About" at its own
 * coordinates on the deployed site and watching the URL not change.
 *
 * ## Why static flow is the answer and not a third guess
 *
 * Both bugs are the same bug: the footer was asking to overlap the page, and
 * then the two of them had to be ordered. Unpositioned, it is the last block on
 * the page, it occupies its own height, and it overlaps nothing — so there is no
 * ordering question left to get wrong, and no z-index anywhere that a later edit
 * can invert.
 *
 * What is lost is the reveal effect. It was never working: what shipped was a
 * footer lying on top of the page.
 */

const read = (rel: string) =>
  fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

describe('footer stacking', () => {
  const footer = read('components/layout/Footer.tsx');

  /** The inline style object on the `<footer>` element, not the whole file. */
  const footerStyle = (() => {
    const anchor = footer.indexOf('data-mr-surface="ink"');
    expect(anchor).toBeGreaterThan(-1);
    return footer.slice(anchor, footer.indexOf('>', footer.indexOf('}}', anchor)));
  })();

  it('does not position the footer', () => {
    // `sticky` and `fixed` have both been tried and both made the footer
    // overlap the page. Only an unpositioned box overlaps nothing.
    expect(footerStyle).not.toMatch(/position:\s*['"](sticky|fixed|absolute)['"]/);
  });

  it('declares no z-index at all', () => {
    /*
     * Not "no positive z-index" — none. 0 put the footer above the page and -1
     * made its links unclickable. An unpositioned box needs neither, and any
     * value here means somebody has re-introduced positioning.
     */
    expect(footerStyle).not.toMatch(/zIndex/);
  });

  it('sets no inset properties, which only mean something when positioned', () => {
    expect(footerStyle).not.toMatch(/\b(top|bottom|left|right):\s*0/);
  });

  it('records why, so the reveal is not re-attempted the same way', () => {
    // Both failures are named in the file. A future attempt at the curtain
    // effect needs to know that these two exact approaches were measured and
    // what each one broke.
    expect(footer).toMatch(/sticky/);
    expect(footer).toMatch(/hit test|hit testing|dead/i);
  });
});
