import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

const typescriptFiles = ["src/**/*.ts", "vite.config.ts", "scripts/**/*.{ts,mts,cts}"];

export default [
  {
    ignores: ["dist/**", "node_modules/**", "templates/assets/**", "src/static/qrcode/qrcode.min.js"],
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: typescriptFiles,
  })),
  {
    files: ["src/**/*.{js,ts}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        Alpine: "readonly",
      },
    },
    rules: {
      "no-console": "error",
    },
  },
  {
    files: ["*.config.{js,cjs}", "vite.config.ts", "scripts/**/*.{js,mjs,ts}"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["vite.config.ts"],
    rules: {
      "no-useless-escape": ["error", { allowRegexCharacters: ["/"] }],
    },
  },
  {
    files: ["src/common/js/debug.js"],
    rules: {
      "no-console": "off",
    },
  },
  prettierConfig,
];
