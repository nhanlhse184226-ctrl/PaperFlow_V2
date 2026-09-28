import js from "@eslint/js";
import ts from "typescript-eslint";
export default ts.config(
  { ignores: ["dist", "node_modules", "playwright-report", "test-results"] },
  {
    files: ["verification/**/*.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        innerWidth: "readonly",
        document: "readonly",
      },
    },
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: { process: "readonly" } },
    rules: { "@typescript-eslint/no-explicit-any": "error" },
  },
);
