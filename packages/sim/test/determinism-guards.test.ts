// Locks in the toolchain guards from plan section 2: code that would break
// determinism must not compile or must not pass lint inside packages/sim/src.
import { ESLint } from "eslint";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { beforeAll, describe, expect, test } from "vitest";

const simDir = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(simDir, "../..");
const SETUP_TIMEOUT_MS = 60_000;

describe("sim tsconfig", () => {
  const forbidden = {
    window: "export const x = window;",
    document: "export const x = document.title;",
    setTimeout: "setTimeout(() => {}, 1);",
    process: "export const x = process.env;",
    Buffer: 'export const x = Buffer.from("x");',
  };
  const probes: Record<string, string> = {
    ...forbidden,
    enum: "enum E { A }\nexport const x = E.A;",
    es2023: "export const x = [3, 1, 2].toSorted((a, b) => a - b);",
  };
  let diagnostics: Record<string, string[]>;

  beforeAll(() => {
    const parsed = ts.getParsedCommandLineOfConfigFile(
      path.join(simDir, "tsconfig.json"),
      {},
      {
        ...ts.sys,
        onUnRecoverableConfigFileDiagnostic: (d) => {
          throw new Error(ts.flattenDiagnosticMessageText(d.messageText, "\n"));
        },
      },
    );
    if (!parsed) throw new Error("could not parse packages/sim/tsconfig.json");

    const fileOf = (name: string) =>
      path.join(simDir, "src", `__probe_${name}.ts`);
    const sources = new Map(
      Object.entries(probes).map(([name, code]) => [fileOf(name), code]),
    );
    const host = ts.createCompilerHost(parsed.options);
    const { getSourceFile, fileExists } = host;
    host.fileExists = (file) =>
      sources.has(file) || fileExists.call(host, file);
    host.getSourceFile = (file, language, ...rest) => {
      const code = sources.get(file);
      return code === undefined
        ? getSourceFile.call(host, file, language, ...rest)
        : ts.createSourceFile(file, code, language);
    };

    const program = ts.createProgram([...sources.keys()], parsed.options, host);
    diagnostics = Object.fromEntries(
      Object.keys(probes).map((name) => {
        const sourceFile = program.getSourceFile(fileOf(name));
        const found = ts.getPreEmitDiagnostics(program, sourceFile);
        return [
          name,
          found.map((d) => ts.flattenDiagnosticMessageText(d.messageText, " ")),
        ];
      }),
    );
  }, SETUP_TIMEOUT_MS);

  test.each(Object.keys(forbidden))("does not know the global %s", (name) => {
    expect(diagnostics[name]).toEqual([
      expect.stringContaining(`Cannot find name '${name}'`),
    ]);
  });

  test("rejects non-erasable syntax such as enum", () => {
    expect(diagnostics.enum).toEqual([
      expect.stringContaining("erasableSyntaxOnly"),
    ]);
  });

  test("allows the ES2023 standard library", () => {
    expect(diagnostics.es2023).toEqual([]);
  });
});

describe("sim lint rules", () => {
  const eslint = new ESLint({ cwd: repoRoot });

  async function ruleIds(file: string, code: string) {
    const [result] = await eslint.lintText(code, {
      filePath: path.join(repoRoot, file),
    });
    return result?.messages.map((m) => m.ruleId) ?? [];
  }

  // Loading the ESLint config is slow on the first call.
  beforeAll(() => ruleIds("packages/sim/src/probe.ts", ""), SETUP_TIMEOUT_MS);

  const forbidden: [string, string][] = [
    ["Math.random()", "no-restricted-properties"],
    ["Math.sin(1)", "no-restricted-properties"],
    ["Math.sqrt(4)", "no-restricted-properties"],
    ["Math.pow(2, 3)", "no-restricted-properties"],
    ["Date.now()", "no-restricted-globals"],
    ["performance.now()", "no-restricted-globals"],
    ["crypto.randomUUID()", "no-restricted-globals"],
    ["new Intl.NumberFormat()", "no-restricted-globals"],
    ["1.5", "no-restricted-syntax"],
    [".5", "no-restricted-syntax"],
    ["1e-3", "no-restricted-syntax"],
  ];

  test.each(forbidden)("forbids %s in sim/src", async (expr, rule) => {
    expect(
      await ruleIds("packages/sim/src/probe.ts", `export const x = ${expr};`),
    ).toEqual([rule]);
  });

  test("forbids for...in in sim/src", async () => {
    const code = "for (const k in {}) console.log(k);";
    expect(await ruleIds("packages/sim/src/probe.ts", code)).toEqual([
      "no-restricted-syntax",
    ]);
  });

  test.each([
    "Math.floor(7 / 2)",
    "Math.imul(3, 5)",
    "1000",
    "1_000",
    "0x1f",
    '"1.5"',
  ])("allows %s in sim/src", async (expr) => {
    expect(
      await ruleIds("packages/sim/src/probe.ts", `export const x = ${expr};`),
    ).toEqual([]);
  });

  test("does not apply the sim rules outside packages/sim/src", async () => {
    const code = "export const x = Math.random() + Date.now() + 1.5;";
    expect(await ruleIds("apps/server/src/probe.ts", code)).toEqual([]);
  });
});
