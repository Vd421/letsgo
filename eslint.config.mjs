// ESLint config: finds likely bugs in JavaScript/TypeScript code.
// Formatting (spaces, quotes) is Prettier's job, not ESLint's.
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  // Folders to skip (generated or downloaded code).
  globalIgnores(["**/node_modules/", "**/dist/", "**/build/", "**/coverage/", "**/generated/"]),

  // Recommended rule sets for JavaScript and TypeScript.
  js.configs.recommended,
  tseslint.configs.recommended,

  // Our code runs in both the browser (dashboard, recorder) and Node (api).
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },

  // Must be last: turns off ESLint rules that would fight with Prettier.
  prettier,
]);
