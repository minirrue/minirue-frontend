import fs from 'fs';
import path from 'path';

/**
 * Every text call-to-action is the house `<Button>` (frontend#105).
 *
 * The owner asked for one button shape everywhere — chat's "Start conversation"
 * and account "Sign out". An audit on 2026-09-13 found 35 buttons and links
 * that had each re-typed a pill by hand (their own padding, tracking and font
 * token), so no two matched. This guard fails when a new one appears: a
 * `<button>`, `<a>` or `<Link>` whose OWN opening tag styles an uppercase label
 * with padding. Chips, tabs, badges, icon buttons and underlined links do not
 * trip it; the few intentional exceptions are listed below with their reason.
 */

const root = path.join(__dirname, '..', '..');

const ALLOWED: Record<string, string> = {
  'components/ui/Button.tsx': 'the house button itself',
  'components/storefront/CollabShowcase.tsx': 'collaborator tabs — a segmented control, not a CTA',
  'components/storefront/ShareButton.tsx': '40px icon + "Share" utility pill, paired with the SKU copy chip',
};

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' || e.name.startsWith('.') ? [] : files(full);
    return e.name.endsWith('.tsx') ? [full] : [];
  });
}

/** Opening tags of clickable elements, up to the first `>` that closes the tag
 * at brace depth 0 (inline style objects contain `>` only inside strings). */
function clickableTags(src: string): { tag: string; line: number }[] {
  const out: { tag: string; line: number }[] = [];
  const re = /<(button|a|Link)[\s>]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let depth = 0;
    let i = m.index + 1;
    for (; i < src.length; i++) {
      const ch = src[i];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (ch === '>' && depth === 0 && src[i - 1] !== '=') break;
    }
    out.push({ tag: src.slice(m.index, i), line: src.slice(0, m.index).split('\n').length });
  }
  return out;
}

describe('text CTAs go through <Button>', () => {
  it('finds no hand-styled uppercase button or link', () => {
    const offenders: string[] = [];
    for (const dir of ['app', 'components']) {
      for (const file of files(path.join(root, dir))) {
        const rel = path.relative(root, file).split(path.sep).join('/');
        if (ALLOWED[rel]) continue;
        const src = fs.readFileSync(file, 'utf8');
        for (const { tag, line } of clickableTags(src)) {
          const uppercase = /textTransform:\s*'uppercase'/.test(tag);
          const padded = /\bpadding:\s*['\d]/.test(tag);
          const surface = /\b(background|border):\s*'(?!0'|none'|transparent'\s*[,}]\s*$)/.test(tag);
          if (uppercase && padded && surface) offenders.push(`${rel}:${line}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
