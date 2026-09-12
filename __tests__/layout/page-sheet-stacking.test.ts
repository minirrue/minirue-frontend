import fs from 'node:fs';
import path from 'node:path';

/**
 * #6 — the account drawer's bottom items were unreachable under the bottom nav.
 *
 * Not DOM order, and not a wrong number at any call site. `.mr-page-sheet`
 * carried `position: relative; z-index: 1`, and a positioned element with a
 * z-index creates a STACKING CONTEXT: every z-index inside it is then resolved
 * against its siblings inside, and the whole subtree is placed in the parent
 * context at that one value.
 *
 * The page sheet wraps the header on every route, and the header renders the
 * mobile nav sheet (z-index 60) and the search sheet (120). `MobileBottomNav`
 * (20), `CartDrawer` (80) and `SupportWidget` (201) are mounted at the root
 * layout, OUTSIDE the sheet. So 60 and 120 were both really 1, and lost to 20.
 *
 * jsdom does not compute stacking, and neither does any unit test — so this
 * reads the declaration itself. That is the whole bug: one property on one
 * wrapper, invisible from every file that suffers from it.
 */

const TOKENS = path.join(process.cwd(), 'app', 'styles', 'mr-tokens.css');

/**
 * The rule's DECLARATIONS, with comments stripped — the comment explaining why
 * there is no z-index necessarily contains the words "z-index", and matching it
 * would be matching the explanation rather than the property.
 */
function pageSheetRule(): string {
  const css = fs.readFileSync(TOKENS, 'utf8');
  const start = css.indexOf('.mr-page-sheet {');
  expect(start).toBeGreaterThan(-1);
  const end = css.indexOf('}', start);
  return css.slice(start, end + 1).replace(/\/\*[\s\S]*?\*\//g, '');
}

describe('.mr-page-sheet must not create a stacking context', () => {
  it('declares no z-index', () => {
    // Restoring it re-seals the mobile menu and the search sheet under the
    // bottom nav, and neither of those files would show why.
    expect(pageSheetRule()).not.toMatch(/z-index/);
  });

  it('is still position: relative, so descendants anchor to it', () => {
    // The fix removes the stacking context, not the containing block.
    expect(pageSheetRule()).toMatch(/position:\s*relative/);
  });

  it('says why, inside the rule, so the next person does not add it back', () => {
    // An absent property explains nothing on its own — and this one looks like
    // an oversight, which is how it gets "fixed" back in.
    const css = fs.readFileSync(TOKENS, 'utf8');
    const start = css.indexOf('.mr-page-sheet {');
    const raw = css.slice(start, css.indexOf('}', start) + 1);

    // Matched separately: the phrase wraps across comment lines.
    expect(raw).toMatch(/stacking/i);
    expect(raw).toMatch(/context/i);
    expect(raw).toMatch(/NO z-index here/);
  });
});

/**
 * The footer reveal was restored WITHOUT touching any of the above, and this is
 * the test that says so (#57).
 *
 * The obvious way to make the page paint over the footer curtain is `z-index: 1`
 * on `.mr-page-sheet`. That is precisely the line this file exists to keep out:
 * it would re-seal not only the mobile menu (60) and the search sheet (120) but
 * `MobileSheet` — the filter and review sheets, 60 — and the review lightbox
 * (70) under the bottom nav's 20, the same class of bug as the untappable
 * Account entry.
 *
 * So the z-index went one level OUT instead, to `.mr-app-layer` in
 * app/layout.tsx. That wrapper holds the page AND every root-mounted overlay —
 * the cart drawer, the support widget, the bottom nav, the page loader — so all
 * of those numbers are still resolved against one another in one context and
 * NOTHING is sealed relative to anything else. What sits outside it is `body`,
 * which is the only thing the footer needs to out-rank.
 *
 * That containment is the whole safety property, so it is asserted here rather
 * than taken on trust: if a future edit moves an overlay out of the layer (or
 * moves the layer inside the page), the numbers start meaning different things
 * again and this fails.
 */
describe('the footer reveal seals nothing (#6 stays fixed)', () => {
  const css = fs.readFileSync(TOKENS, 'utf8');
  const layout = fs.readFileSync(path.join(process.cwd(), 'app', 'layout.tsx'), 'utf8');

  it('the stacking context is on .mr-app-layer, not on .mr-page-sheet', () => {
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const layer = /\.mr-app-layer[^{]*\{[^}]*\}/.exec(stripped);
    expect(layer).not.toBeNull();
    expect(layer![0]).toMatch(/z-index:\s*1\b/);
    // ...and the sheet still has none. Both halves, or the bug is back.
    expect(pageSheetRule()).not.toMatch(/z-index/);
  });

  it('.mr-app-layer contains the page AND every root-mounted overlay', () => {
    // A stacking context only seals things that are inside it while their
    // rivals are outside. Everything that competes on z-index lives in here
    // together, so nothing changes rank relative to anything else.
    const open = layout.indexOf('<div className="mr-app-layer">');
    expect(open).toBeGreaterThan(-1);
    const close = layout.lastIndexOf('</div>');
    expect(close).toBeGreaterThan(open);
    const inside = layout.slice(open, close);

    for (const mounted of ['{children}', '<CartDrawer />', '<SupportWidget />', '<MobileBottomNav />', '<PageLoader />']) {
      expect(inside).toContain(mounted);
    }
  });
});

describe('the overlays that depend on it', () => {
  const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

  it('the mobile nav sheet still outranks the bottom nav', () => {
    // The numbers were never wrong — they were being resolved in the wrong
    // context. Pinned so a later "tidy the z-indexes" pass cannot invert them.
    const sheet = read('components/layout/MobileNavSheet.tsx');
    const nav = read('components/layout/MobileBottomNav.tsx');

    const sheetZ = Number(sheet.match(/zIndex:\s*(\d+)/)?.[1]);
    const navZ = Number(nav.match(/zIndex:\s*(\d+)/)?.[1]);

    expect(sheetZ).toBeGreaterThan(navZ);
  });

  it('the search sheet outranks the bottom nav too', () => {
    const search = read('components/layout/SearchSheet.tsx');
    const nav = read('components/layout/MobileBottomNav.tsx');

    const searchZ = Number(search.match(/zIndex:\s*(\d+)/)?.[1]);
    const navZ = Number(nav.match(/zIndex:\s*(\d+)/)?.[1]);

    expect(searchZ).toBeGreaterThan(navZ);
  });
});
