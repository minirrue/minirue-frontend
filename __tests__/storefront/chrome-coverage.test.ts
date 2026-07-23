import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

// A page that renders <Header> without a navbar prop compiles (TS catches it,
// but only on build) and silently ships an empty menu. Assert it directly.
//
// `fs.globSync`'s TS types aren't available at this project's installed
// @types/node version, so this walks the tree by hand instead. `[^>]*`
// (rather than `.*`) already spans multi-line JSX attribute lists without
// needing the `s` (dotAll) regex flag, which this tsconfig's ES2017 target
// doesn't support either.
const ROOT = path.resolve(__dirname, '../..');
const SEARCH_DIRS = ['app', 'components'];

function listTsxFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTsxFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      files.push(full);
    }
  }
  return files;
}

const files = SEARCH_DIRS.flatMap((d) => listTsxFiles(path.join(ROOT, d)));

describe('chrome wiring', () => {
  it('every <Header> usage passes a navbar prop', () => {
    const offenders = files.filter((f) => {
      const src = readFileSync(f, 'utf8');
      if (!/<Header[\s/>]/.test(src)) return false;
      return !/<Header[^>]*navbar=/.test(src);
    });
    expect(offenders).toEqual([]);
  });

  it('every <Footer> usage passes a config prop', () => {
    const offenders = files.filter((f) => {
      const src = readFileSync(f, 'utf8');
      if (!/<Footer[\s/>]/.test(src)) return false;
      return !/<Footer[^>]*config=/.test(src);
    });
    expect(offenders).toEqual([]);
  });
});
