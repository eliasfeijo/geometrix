// The sim's toolchain guards apply to the junction package too (junction plan
// P1): the host steps the world and the battles, so code that would break
// determinism must not compile or must not pass lint inside
// packages/junction/src.
import { ESLint } from "eslint";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { beforeAll, describe, expect, test } from "vitest";

const junctionDir = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(junctionDir, "../..");
// Loading TypeScript and the ESLint config takes ~10 s on /mnt/c, and much more
// while the whole suite (and the sim's own guard test) runs in parallel.
const SETUP_TIMEOUT_MS = 180_000;

describe("junction tsconfig", () => {
  const probes: Record<string, string> = {
    window: "export const x = window;",
    setTimeout: "setTimeout(() => {}, 1);",
    process: "export const x = process.env;",
    Buffer: 'export const x = Buffer.from("x");',
  };
  let diagnostics: Record<string, string[]>;

  beforeAll(() => {
    const parsed = ts.getParsedCommandLineOfConfigFile(
      path.join(junctionDir, "tsconfig.json"),
      {},
      {
        ...ts.sys,
        onUnRecoverableConfigFileDiagnostic: (d) => {
          throw new Error(ts.flattenDiagnosticMessageText(d.messageText, "\n"));
        },
      },
    );
    if (!parsed)
      throw new Error("could not parse packages/junction/tsconfig.json");

    const fileOf = (name: string) =>
      path.join(junctionDir, "src", `__probe_${name}.ts`);
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

  test.each(Object.keys(probes))("does not know the global %s", (name) => {
    expect(diagnostics[name]).toEqual([
      expect.stringContaining(`Cannot find name '${name}'`),
    ]);
  });
});

describe("junction lint rules", () => {
  const eslint = new ESLint({ cwd: repoRoot });
  const probe = "packages/junction/src/probe.ts";

  async function ruleIds(code: string) {
    const [result] = await eslint.lintText(code, {
      filePath: path.join(repoRoot, probe),
    });
    return result?.messages.map((m) => m.ruleId) ?? [];
  }

  // Loading the ESLint config is slow on the first call.
  beforeAll(() => ruleIds(""), SETUP_TIMEOUT_MS);

  test.each([
    ["Math.random()", "no-restricted-properties"],
    ["Math.sqrt(4)", "no-restricted-properties"],
    ["Date.now()", "no-restricted-globals"],
    ["performance.now()", "no-restricted-globals"],
    ["1.5", "no-restricted-syntax"],
  ])("forbids %s in junction/src", async (expr, rule) => {
    expect(await ruleIds(`export const x = ${expr};`)).toEqual([rule]);
  });

  test("forbids for...in in junction/src", async () => {
    expect(await ruleIds("for (const k in {}) console.log(k);")).toEqual([
      "no-restricted-syntax",
    ]);
  });

  test("allows integer math in junction/src", async () => {
    expect(
      await ruleIds("export const x = Math.floor(7 / 2) + 1_000;"),
    ).toEqual([]);
  });
});
