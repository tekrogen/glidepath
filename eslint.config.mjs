import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    ignores: [
      "*.config.mjs",
      "*.config.ts",
      ".next/**",
      "out/**",
      "node_modules/**",
      "admin/**",
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // React-Compiler-era rules that flag the standard `useEffect(() =>
      // setMounted(true), [])` hydration guard and per-request Date usage in
      // server components. Both idioms are intentional here — keep the rules
      // visible as warnings rather than failing the build.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
];
