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
