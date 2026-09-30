/**
 * A folder whose name starts with `_` is a private folder in the App Router:
 * it and everything under it are left out of routing. A page placed there
 * builds fine and 404s in production (#194, `/_internal/preview`). URLs that
 * start with `_` use the documented `%5F` escape instead (`app/%5Finternal/…`).
 */
import fs from 'node:fs';
import path from 'node:path';

const appDir = path.join(process.cwd(), 'app');
const ROUTE_FILE = /^(page|route)\.(tsx|ts|jsx|js|mdx)$/;

function routeFilesUnderPrivateFolders(dir: string, insidePrivate = false): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...routeFilesUnderPrivateFolders(full, insidePrivate || entry.name.startsWith('_')));
    } else if (insidePrivate && ROUTE_FILE.test(entry.name)) {
      found.push(path.relative(appDir, full).replaceAll('\\', '/'));
    }
  }
  return found;
}

describe('private folders', () => {
  it('hold no page or route file (it would never be served)', () => {
    expect(routeFilesUnderPrivateFolders(appDir)).toEqual([]);
  });

  it('/_internal/preview is served from the %5F-escaped folder', () => {
    expect(fs.existsSync(path.join(appDir, '%5Finternal', 'preview', 'page.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(appDir, '%5Finternal', 'preview', 'layout.tsx'))).toBe(true);
  });
});
