import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import { defineConfig, globalIgnores } from "eslint/config";

// eslint-config-next 15 ships eslintrc-style configs; FlatCompat loads them
// into ESLint 9's flat config (eslint-config-next 16 exports flat configs
// directly, but needs Next 16).
const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const eslintConfig = defineConfig([
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // The codebase uses `any` throughout; reported, but not a build failure.
    rules: { "@typescript-eslint/no-explicit-any": "warn" },
  },
  {
    // Node scripts run as CommonJS, outside the Next build.
    files: ["scripts/**/*.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
