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
  {
    // The parallel sessions' worktrees are other checkouts (.gitignore).
    ignores: [
      "**/node_modules/",
      "**/dist/",
      "**/coverage/",
      "runs/",
      ".claude/worktrees/",
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    // Determinism guards for the simulations (plan section 2): the world, bot
    // strategists included (their decisions go into the command log), and the
    // battle (ADR-0008).
    files: ["packages/sim/src/**/*.ts", "packages/battle/src/**/*.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        ...nondeterministicMath.map((property) => ({
          object: "Math",
          property,
          message:
            "Nondeterministic in a simulation: use the seeded RNG or integer math.",
        })),
      ],
      "no-restricted-globals": [
        "error",
        ...["Date", "performance", "crypto", "Intl"].map((name) => ({
          name,
          message:
            "Clocks, crypto and locale APIs are not allowed in a simulation.",
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
          message: "Floating-point literals are not allowed in a simulation.",
        },
      ],
    },
  },
);
