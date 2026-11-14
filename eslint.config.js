import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

// Math functions whose results may differ between JS engines (V8 × JSC), plus
// Math.random. ADR-0003 rule 3 and plan section 2.
const nondeterministicMath = [
  "random",
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "atan2",
  "sinh",
  "cosh",
  "tanh",
  "asinh",
  "acosh",
  "atanh",
  "exp",
  "expm1",
  "log",
  "log1p",
  "log2",
  "log10",
  "pow",
  "sqrt",
  "cbrt",
  "hypot",
];

export default defineConfig(
  { ignores: ["**/node_modules/", "**/dist/", "**/coverage/", "runs/"] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    // Determinism guards for the simulation (plan section 2), and for the bot
    // strategists, whose decisions go into the command log.
    files: ["packages/sim/src/**/*.ts", "apps/cli/src/strategist.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        ...nondeterministicMath.map((property) => ({
          object: "Math",
          property,
          message:
            "Nondeterministic in the sim: use the seeded RNG or integer math.",
        })),
      ],
      "no-restricted-globals": [
        "error",
        ...["Date", "performance", "crypto", "Intl"].map((name) => ({
          name,
          message: "Clocks, crypto and locale APIs are not allowed in the sim.",
        })),
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "ForInStatement",
          message: "for...in has no guaranteed order: iterate arrays by id.",
        },
        {
          // Number literals with a fraction or a negative exponent: 1.5, .5, 1e-3.
          selector: String.raw`Literal[raw=/^(?:\d[\d_]*)?\.\d|^[\d_.]+[eE]-/]`,
          message: "Floating-point literals are not allowed in the sim.",
        },
      ],
    },
  },
);
