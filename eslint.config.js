// ESLint's recommended rules; Prettier does the formatting (npm run lint checks both).
import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["build/"] },
  js.configs.recommended,
  {
    rules: {
      curly: ["error", "multi-line"], // braces when the body is on its own line
      "no-sequences": "error", // no comma expressions
      "one-var": ["error", "never"], // one declaration per statement
    },
  },
  { files: ["web/**", "patch/**"], languageOptions: { globals: globals.browser } },
  { files: ["build.mjs", "dev.mjs", "eslint.config.js", "tests/**"], languageOptions: { globals: globals.node } },
];
