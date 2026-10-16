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
    // Local git worktrees used by parallel feature work — untracked build
    // output from those checkouts (compiled .next bundles included) is not part
    // of this repo's source and must not be linted.
    ".worktrees/**",
  ]),
]);

export default eslintConfig;
