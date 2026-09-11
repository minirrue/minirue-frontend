import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Installed Claude Code skill libraries — vendored third-party scripts,
    // untracked by git, and not this project's code to hold to its rules. They
    // were contributing 36 of 113 lint errors (a CommonJS helper server, a
    // browser-driver script), none of which ship to a user.
    ".claude/**",
  ]),
  {
    rules: {
      // The codebase already marks deliberately-unused bindings with a leading
      // underscore (see components/ui/Input.tsx's `className: _c, style: _s`).
      // The rule was not configured to honour that, so those read as errors
      // alongside genuinely dead code. Everything that is actually dead is
      // deleted rather than renamed.
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
    },
  },
]);

export default eslintConfig;
