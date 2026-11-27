// ESLint's, typescript-eslint's and Vue's recommended rules; Prettier does the formatting (npm run
// lint checks both, vue-tsc the types: npm run typecheck).
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import vue from "eslint-plugin-vue";
import globals from "globals";
import ts from "typescript-eslint";

export default [
  { ignores: ["build/"] },
  js.configs.recommended,
  ...ts.configs.recommended.map((config) => ({ ...config, files: ["**/*.ts", "**/*.vue"] })),
  ...vue.configs["flat/recommended"],
  { files: ["**/*.vue"], languageOptions: { parserOptions: { parser: ts.parser } } },
  prettier,
  {
    rules: {
      curly: ["error", "multi-line"], // braces when the body is on its own line
      "no-sequences": "error", // no comma expressions
      "one-var": ["error", "never"], // one declaration per statement
    },
  },
  { files: ["web/**", "patch/**", "drum/**"], languageOptions: { globals: globals.browser } },
  {
    files: ["vite.config.js", "eslint.config.js", "tests/**"],
    languageOptions: { globals: globals.node },
  },
];
