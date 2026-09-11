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
