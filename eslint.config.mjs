import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import puramaConfig from "./config/eslint/purama.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...puramaConfig,
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
