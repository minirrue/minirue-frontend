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

      /**
       * A warning, not an error — and deliberately still on.
       *
       * Every occurrence in this repo is one of two patterns that a Next.js App
       * Router app cannot express any other way:
       *
       *   - the mounted flag that defers client-only UI past hydration
       *     (components/ui/ClientOnly.tsx is the canonical one), and
       *   - reading something that does not exist on the server — window
       *     dimensions, localStorage, a resolved query — which can only happen
       *     after mount, i.e. in an effect.
       *
       * Rewriting those to satisfy the rule reintroduces the hydration
       * mismatches they exist to prevent, so they are not going to be rewritten
       * to make a linter quiet. Left as a warning rather than switched off
       * because the rule does also catch genuine cascading-render bugs, and a
       * new one should still be visible to whoever adds it.
       */
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
