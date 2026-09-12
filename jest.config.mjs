import nextJest from 'next/jest.js';

/**
 * Plain .mjs, not .ts, deliberately.
 *
 * Jest only reads a TypeScript config when it can strip the types — either
 * `ts-node` is installed, or the Node running it is new enough to do it
 * natively. Neither held in CI: `ts-node` is not a dependency of this project
 * and CI runs Node 20, so every CI run died before a single test with
 * "Jest: 'ts-node' is required for the TypeScript configuration files".
 *
 * It passed locally only because a developer's Node (24) strips types on its
 * own — which is exactly the shape of bug that stays invisible until someone
 * reads a CI log. A .mjs config needs neither.
 */

/** @typedef {import('jest').Config} Config */

const createJestConfig = nextJest({ dir: './' });

/** @type {Config} */
const config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  /*
   * A nested checkout inside the repo must not be collected.
   *
   * `testMatch` is a bare `**` glob with no floor, so anything containing a
   * `__tests__` directory anywhere under rootDir is a test root — including a
   * git worktree created inside the repo. `.claude/worktrees/` is where agent
   * worktrees land, and with three of them present a run went from 108 suites
   * to 540, reporting 16 failures that belonged to other branches entirely.
   *
   * That is worse than noisy: the gate keeps passing or failing for reasons
   * that have nothing to do with the diff under test, and the suite count is
   * large enough that nobody reads it. `.next` is here for the same reason —
   * `output: standalone` copies package.json files into `.next/standalone`,
   * which also produces haste-map collision warnings.
   */
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/.claude/',
    '<rootDir>/.next/',
  ],
  modulePathIgnorePatterns: ['<rootDir>/.claude/', '<rootDir>/.next/'],
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  // Real measured coverage (2026-07-14, after adding components/** to collectCoverageFrom)
  // was statements 9.68%, branches 48.78%, functions 21.93%, lines 9.68%. Thresholds below
  // are that number rounded down 2-3 points so the gate is honest today and ratchets up as
  // real tests get added, rather than the previous decorative 80/75 that excluded components/
  // entirely (56 files invisible to coverage).
  coverageThreshold: {
    global: {
      statements: 7,
      branches: 46,
      functions: 19,
      lines: 7,
    },
  },
};

export default createJestConfig(config);
