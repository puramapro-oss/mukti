import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import puramaConfig from "@purama/eslint-config";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...puramaConfig,
  // These Node harnesses load production TypeScript in a CommonJS VM context.
  {
    files: [
      "tests/aurora-regression/completion-wiring.cjs",
      "tests/aurora-regression/runtime-regression.cjs",
    ],
    languageOptions: { sourceType: "commonjs" },
    rules: {
      "@typescript-eslint/no-require-imports": ["error", {
        allow: ["^node:(?:test|assert/strict|fs|path|vm|events)$", "^typescript$"],
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".vercel/**",
    // Scripts CLI tools need console.log for their output
    "scripts/**",
  ]),
]);

export default eslintConfig;
