// Shared flat ESLint config for every app/* and packages/*. Lives once at the repo root
// instead of duplicated per package — ESLint 9's flat config does NOT search parent
// directories for a config file the way the old .eslintrc cascade did, so each package's
// own "lint" script points here explicitly with `--config ../../eslint.config.js` (see
// apps/shell/package.json etc.) rather than relying on discovery.
//
// The plugins imported below only need to resolve from THIS file's own location (the repo
// root's node_modules), regardless of which package's directory `eslint` was invoked from
// — that's why they're declared once as root devDependencies instead of duplicated into
// every app's package.json.
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/.vite/**",
      "**/public/pdfjs/**",
      "supabase/functions/**", // Deno runtime, not linted from any app's own `eslint .`
      // Vendored verbatim from supabase/functions/_shared by scripts/vendor-shared.mjs (see
      // apps/m5-documents) — arabic.ts's Arabic-script Unicode ranges trip
      // no-irregular-whitespace, correctly, since some of those codepoints really do look
      // like whitespace to a linter. Not a mistake to fix; lint the source instead if ever needed.
      "**/_shared-vendor/**",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      // Covers both browser-context src/ code and Node-context scripts/ and vite.config.ts
      // within the same package, without per-file overrides.
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // Vendored template source (packages/*) intentionally has unused exports meant for
      // apps that haven't been scaffolded yet.
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
);
