import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "templates/assets/**",
      "src/static/qrcode/qrcode.min.js",
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        Alpine: "readonly",
      },
    },
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    files: ["**/*.{js,ts}"],
    rules: {
      // Add your custom rules here
    },
  },
];
