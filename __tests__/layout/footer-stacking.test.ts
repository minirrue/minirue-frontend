import fs from 'fs';
import path from 'path';

/**
 * The footer reveal ("the outer reveal under the webpage"), the four ways it
 * was got wrong, and the reason it is now back to what shipped before
 * September (#57).
 *
 * ## What the effect needs
 *
 * The page has to slide up and off the footer. That means the footer must be
 * PAINTED somewhere other than where it sits in flow — only `fixed`/`sticky`
 * can do that — and it must paint UNDER `.mr-page-sheet`, which is itself
 * `position: relative`. Two positioned boxes, so something has to order them.
 *
 * ## The line that did that, and the day it was deleted
 *
 * `.mr-page-sheet { position: relative; z-index: 1 }`. The page out-ranked the
 * footer, the footer sat behind it, and it was uncovered as the page scrolled
 * up off it. `00cd9ec` (#25) removed it to fix #6 — a stacking context on the
 * page sheet seals the mobile nav sheet (60), the search sheet (120),
 * `MobileSheet` (60) and the review lightbox (70) under the root-mounted bottom
 * nav (20) — and every footer rewrite after that was fixing a symptom of a
 * change in a different file.
 *
 * ## The four attempts, all of which ordered them in the ROOT stacking context
 *
 * **`fixed; bottom: 0`** — rendered after the sheet, so it painted over the
 * page; and once the footer's own content grew taller than the viewport its top
 * edge was pinned off screen, the wordmark was clipped, and nothing could
 * scroll to it. It needed a `ResizeObserver` writing
 * `document.body.style.paddingBottom` to fake in-flow height.
 *
 * **`sticky; bottom: 0; z-index: 0`** — measured on the live site, Pixel 5,
 * homepage:
 *
 *     footer   position: sticky    zIndex: 0     top: 30   height: 697
 *     sheet    position: relative  zIndex: auto            bottom: 2465
 *
 * A 697px footer pinned across an 851px viewport with 2465px of page still
 * scrolling underneath it. Without the sheet's `z-index: 1` the two tied at 0
 * and the footer won the tie on tree order, being the later sibling.
 *
 * **`sticky; z-index: -1`** — corrected the painting and broke hit testing with
 * it. In the ROOT stacking context `body`'s own background box paints at the
 * in-flow step, which is ABOVE a negative-z-index box, so it swallowed every
 * pointer event: the footer rendered perfectly and every link in it was dead.
 * Caught by clicking "About" at its own coordinates on the deployed site and
 * watching the URL not change.
 *
 * **the `fixed`/`absolute` curtain rendered BEFORE the sheet (#48/#54)** — the
 * reveal worked and the links worked, ordered by document order with no z-index
 * anywhere. The costs were the footer coming ahead of the entire page in the
 * DOM (keyboard and screen-reader order hit it first), a band reserved by
 * writing a measured `--mr-footer-h` into `body`'s padding on every resize, and
 * a choice between two positions made from a viewport measurement that a mobile
 * browser toolbar moves (#50).
 *
 * ## The invariant this file now enforces
 *
 * The footer is the pre-September one: `position: sticky; bottom: 0`, in normal
 * flow, rendered AFTER `.mr-page-sheet` (audited in footer.test.tsx). The
 * z-index that used to sit on the page sheet now sits one level out, on
 * `.mr-app-layer` in app/layout.tsx — a single stacking context around the page
 * AND the root-mounted overlays, so every z-index in the app still resolves
 * against every other one and #6 stays fixed.
 *
 * Inside that layer the curtain is `z-index: -1`, and that is the whole reason
 * the third attempt's value is safe here and was fatal there: the layer paints
 * above `body`, the layer's own box is transparent and paints below its
 * negative child, so hit testing is ordinary. The two halves are ONE mechanism
 * and both are asserted below — `z-index: -1` without `.mr-app-layer` is the
 * dead-links bug, exactly.
 *
 * `<footer>` itself stays an unpositioned box with no z-index and no insets;
 * every failure above put those properties there.
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
    // page sheet in the root stacking context, and both answers were bugs.
    expect(footerStyle).not.toMatch(/position:\s*['"](sticky|fixed|absolute)['"]/);
  });

  it('declares no z-index at all', () => {
    expect(footerStyle).not.toMatch(/zIndex/);
  });

  it('sets no inset properties, which only mean something when positioned', () => {
    expect(footerStyle).not.toMatch(/\b(top|bottom|left|right):\s*0/);
  });

  it('records why, so the reveal is not re-attempted the same way', () => {
    // All four failures are named in the file. A future edit needs to know that
    // these exact approaches were measured and what each one broke.
    expect(footer).toMatch(/sticky/);
    expect(footer).toMatch(/hit test|hit testing|dead/i);
  });
});

describe('the curtain wrapper — the pre-September positioning, restored', () => {
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

  const appLayerRule = (() => {
    const css = tokens.replace(/\/\*[\s\S]*?\*\//g, '');
    const m = /\.mr-app-layer[^{]*\{[^}]*\}/.exec(css);
    expect(m).not.toBeNull();
    return m![0];
  })();

  it('wraps the footer in a positioned element, so the reveal exists at all', () => {
    // An unpositioned box overlaps nothing, so it can be revealed from under
    // nothing. This is the property the static-flow footer traded the effect
    // away for, and it is what the owner reported missing.
    expect(footer).toMatch(/className="mr-footer-curtain"/);
    expect(curtainRules).toMatch(/position:\s*sticky/);
    expect(curtainRules).toMatch(/bottom:\s*0/);
  });

  it('is `sticky`, not `fixed` — it is a real box in normal flow', () => {
    // `fixed` is out of flow, which is why it needed a reserved band measured
    // into `body`'s padding on every resize. A sticky footer carries its own
    // height, so the document is naturally that much taller and there is
    // nothing to reserve.
    expect(curtainRules).not.toMatch(/position:\s*fixed/);
    expect(curtainRules).not.toMatch(/position:\s*absolute/);
  });

  it('is ordered under the page by a z-index scoped to .mr-app-layer', () => {
    // BOTH halves, together, are the mechanism. `z-index: -1` on its own is
    // the version that shipped with every footer link dead: in the root
    // stacking context `body`'s background box paints above a negative box and
    // takes its pointer events. Inside `.mr-app-layer` the whole layer paints
    // above `body`, so ordinary hit testing applies.
    expect(curtainRules).toMatch(/z-index:\s*-1/);
    expect(appLayerRule).toMatch(/position:\s*relative/);
    expect(appLayerRule).toMatch(/z-index:\s*1\b/);
    expect(read('app/layout.tsx')).toMatch(/className="mr-app-layer"/);
  });

  it('is sticky UNCONDITIONALLY — there is no taller-than-viewport fallback', () => {
    /*
     * The test that used to live here asserted the opposite, and asserting it
     * is what let the bug ship.
     *
     * A `[data-curtain='flow'] { position: static }` rule, driven by JS that
     * measured the footer against the viewport, dropped the stickiness whenever
     * the footer was taller. The footer is ~748px, so that answered YES on a
     * Pixel 5 (727px), an iPhone 12 (664px) and a 1440x720 laptop — every phone
     * and any short laptop lost the reveal and got a block sitting vertically
     * underneath the page instead. Which is exactly what the owner reported,
     * twice.
     *
     * The guard was real CSS behaviour — a sticky box pinned by `bottom: 0`
     * that is taller than the scrollport holds its own top above the viewport
     * WHILE PINNED — but it un-sticks at its flow position at the end of the
     * document, which is where the reveal finishes, so the top is reachable
     * regardless. The pre-September footer had no such guard and worked.
     *
     * If the footer ever genuinely must fit, shorten the FOOTER. Do not
     * reintroduce a mechanism that decides per viewport.
     */
    expect(curtainRules).toMatch(/position:\s*sticky/);
    expect(curtainRules).not.toMatch(/position:\s*static/);
    expect(tokens).not.toMatch(/data-curtain/);
  });

  it('needs no JavaScript at all', () => {
    /*
     * The reveal is three CSS declarations. This file briefly carried a
     * ResizeObserver, a `100svh` probe element, a `document.fonts.ready` wait
     * and a state swap — all to answer "is the footer taller than the
     * viewport?", a question that turned out not to need answering.
     *
     * A footer that re-decides its own positioning at runtime is how this
     * component acquired a font-loading race that permanently demoted a
     * 1440x720 laptop on a measurement taken before the webfonts landed.
     */
    // Comments stripped first — the prose above names the machinery it
    // describes removing, and matching that would be matching the explanation.
    const code = footer.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
    expect(code).not.toMatch(/useState|useEffect|ResizeObserver/);
  });

  it('reserves no band and writes nothing to `body`', () => {
    // The three things the September machinery needed, all gone with it: the
    // inline body style the first attempt wrote, the custom property the last
    // one replaced it with, and the `position: relative` that anchored the
    // `absolute` fallback.
    // An assignment, not the mention of it — Footer.tsx names both deleted
    // mechanisms in prose precisely so neither is reinvented.
    expect(footer).not.toMatch(/body\.style\.paddingBottom\s*=/);
    expect(footer).not.toMatch(/setProperty\([^)]*--mr-footer-h/);
    expect(footer).not.toMatch(/FOOTER_HEIGHT_VAR/);
    // Comments stripped first, here and below: the prose that records why each
    // of these was removed necessarily spells the declaration out, and matching
    // that would be matching the explanation rather than the CSS.
    const globalsCss = globals.replace(/\/\*[\s\S]*?\*\//g, '');
    const tokensCss = tokens.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(globalsCss).not.toMatch(/padding-bottom:\s*var\(--mr-footer-h/);
    expect(tokensCss).not.toMatch(/^\s*--mr-footer-h:/m);

    // `body` must declare no footer-driven layout at all.
    const bodyRules = [...globalsCss.matchAll(/(^|\n)\s*body\s*\{[^}]*\}/g)]
      .map((m) => m[0])
      .join('\n');
    expect(bodyRules).not.toMatch(/padding-bottom/);
    expect(bodyRules).not.toMatch(/position:\s*relative/);
  });
});
