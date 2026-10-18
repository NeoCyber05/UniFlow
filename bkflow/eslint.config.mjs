import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default defineConfig([
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    // Parity with eslint-config-next: unused vars and React Compiler rules are advisory.
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  globalIgnores(["node_modules/**", "web/dist/**", "build/**", "out/**"]),
]);
