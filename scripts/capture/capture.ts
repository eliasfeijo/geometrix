#!/usr/bin/env node
// npm run capture: screenshots of the real game and the battle lab, for the
// docs (docs/OVERVIEW.md). It builds the client, starts a private server on
// its own port with a throwaway database, creates two bot-vs-bot worlds with a
// human guest on Blue, and drives the pages in a headless Chromium
// (Playwright). Everything lands in runs/capture-<id>/ (ignored by git): pick
// the frames worth keeping and copy them to docs/img/ by hand.
//
// The worlds run in real time, so two runs never give the same pictures.
// Development only.

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import { parseArgs } from "node:util";
import { chromium, type Browser, type Page } from "playwright";

const USAGE = `usage: npm run capture -- [options]

  --port <n>      the private server's port (default 8097)
  --seed <n>      the worlds' seed (default 7)
  --only <a,b>    only these scenes (default: all). Scenes: ${"\n                  "}lobby, world-start, inspector, battle, lab, world-late, replay
  --no-build      serve the client build already in apps/client/dist
  --width <n>     viewport width (default 1440)
  --height <n>    viewport height (default 900)
`;

const SCENES = [
  "lobby",
  "world-start",
  "inspector",
  "battle",
  "lab",
  "world-late",
  "replay",
] as const;
type Scene = (typeof SCENES)[number];

const ROOT = new URL("../../", import.meta.url);
/** The fast world (×2000) reaches its third day in about 110 real seconds. */
const FAST_MULTIPLIER = 2000;
/** The slow world (×600) gives battles that open while the page watches. */
const SLOW_MULTIPLIER = 600;
const STARTUP_TIMEOUT_MS = 60_000;

type Options = {
  port: number;
  seed: number;
  scenes: Set<Scene>;
  build: boolean;
  width: number;
  height: number;
};

function parseOptions(args: string[]): Options {
  const { values } = parseArgs({
    args,
    options: {
      port: { type: "string" },
      seed: { type: "string" },
      only: { type: "string" },
      "no-build": { type: "boolean" },
      width: { type: "string" },
      height: { type: "string" },
      help: { type: "boolean" },
    },
    strict: true,
  });
  if (values.help === true) {
    console.log(USAGE);
    process.exit(0);
  }
  const int = (name: string, raw: string | undefined, fallback: number) => {
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`--${name} must be a non-negative integer`);
    }
    return value;
  };
  const scenes = new Set<Scene>();
  for (const name of values.only?.split(",") ?? SCENES) {
    const scene = SCENES.find((s) => s === name.trim());
    if (scene === undefined) throw new Error(`unknown scene: ${name}`);
    scenes.add(scene);
  }
  return {
    port: int("port", values.port, 8097),
    seed: int("seed", values.seed, 7),
    scenes,
    build: values["no-build"] !== true,
    width: int("width", values.width, 1440),
    height: int("height", values.height, 900),
  };
}

type Session = { playerId: number; team: number; token: string };
type World = { id: number; session: Session; name: string };

class Server {
  readonly base: string;
  private readonly child: ChildProcess;

  constructor(port: number, outDir: string) {
    this.base = `http://localhost:${port}`;
    const log = createWriteStream(`${outDir}/server.log`);
    this.child = spawn(process.execPath, ["apps/server/src/main.ts"], {
      cwd: ROOT,
      env: {
        ...process.env,
        GEO_PORT: String(port),
        GEO_DB: `${outDir}/geo.db`,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    this.child.stdout?.pipe(log);
    this.child.stderr?.pipe(log);
  }

  async ready(): Promise<void> {
    const deadline = Date.now() + STARTUP_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (this.child.exitCode !== null) {
        throw new Error("the server exited: see server.log");
      }
      try {
        if ((await fetch(`${this.base}/api/worlds`)).ok) return;
      } catch {
        // not listening yet
      }
      await sleep(250);
    }
    throw new Error("the server did not start in time");
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(this.base + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`${path}: ${response.status} ${await response.text()}`);
    }
    return (await response.json()) as T;
  }

  /** A world with a bot on each team and a human guest on Blue. */
  async world(seed: number, multiplier: number, name: string): Promise<World> {
    const { id } = await this.post<{ id: number }>("/api/worlds", {
      seed,
      multiplier,
      botTeams: [0, 1],
    });
    const session = await this.post<Session>(`/api/worlds/${id}/join`, {
      name,
      team: 0,
    });
    return { id, session, name };
  }

  async status(worldId: number): Promise<string | undefined> {
    const list = (await (await fetch(`${this.base}/api/worlds`)).json()) as {
      id: number;
      status: string;
    }[];
    return list.find((w) => w.id === worldId)?.status;
  }

  /** The player's tab, as npm run dev:multi hands it over. */
  tab(world: World): string {
    const { session } = world;
    const fragment = new URLSearchParams({
      token: session.token,
      player: String(session.playerId),
      team: String(session.team),
      name: world.name,
    });
    return `${this.base}/?world=${world.id}&slot=${world.id}#${fragment}`;
  }

  stop(): void {
    this.child.kill();
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Clicks the middle of an SVG element (the map picks cells by position). */
async function clickCenter(page: Page, selector: string): Promise<boolean> {
  const box = await page.locator(selector).first().boundingBox();
  if (box === null) return false;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  return true;
}

async function waitUntil(
  check: () => Promise<boolean>,
  timeoutMs: number,
  stepMs = 250,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return true;
    await sleep(stepMs);
  }
  return false;
}

class Capture {
  readonly shots: string[] = [];
  private readonly outDir: string;

  constructor(outDir: string) {
    this.outDir = outDir;
  }

  async shot(page: Page, name: string): Promise<void> {
    const path = `${this.outDir}/${name}.png`;
    await page.screenshot({ path });
    this.shots.push(path);
    console.log(`  ${name}.png`);
  }
}

async function lobby(page: Page, server: Server, capture: Capture) {
  await page.goto(server.base);
  await page
    .getByText(/Mundo #/)
    .first()
    .waitFor();
  await sleep(500);
  await capture.shot(page, "lobby");
}

/** The slow world's tab: the start under the fog and a creep's rules. */
async function worldStart(
  page: Page,
  scenes: Set<Scene>,
  capture: Capture,
): Promise<void> {
  await page.locator("g.creep").first().waitFor();
  // About one world hour at ×600: the first road and deliveries show.
  await sleep(6000);
  if (scenes.has("world-start")) await capture.shot(page, "world-start");
  if (scenes.has("inspector") && (await clickCenter(page, "g.creep"))) {
    await page.getByText("Piloto automático").first().waitFor();
    await sleep(500);
    await capture.shot(page, "inspector");
    await page.keyboard.press("Escape");
  }
}

/**
 * A battle on the slow world: with a human connected, a new battle holds for
 * a few real seconds (R F5), long enough to click its sign on the map, watch
 * it, and dominate the Blue participant, which plays the battle in real time.
 */
async function battle(page: Page, capture: Capture): Promise<void> {
  const found = await waitUntil(async () => {
    if ((await page.locator("g.battle-signs > *").count()) === 0) return false;
    if (!(await clickCenter(page, "g.battle-signs > *"))) return false;
    const watch = page.getByRole("button", { name: /Assistir|Voltar à/ });
    if ((await watch.count()) === 0) return false;
    await watch.first().click();
    return true;
  }, 240_000);
  if (!found) {
    console.log("  (no battle opened in time: skipped)");
    return;
  }
  await sleep(400);
  await capture.shot(page, "battle-hold");
  const dominate = page.getByRole("button", { name: "dominar" });
  if ((await dominate.count()) > 0) await dominate.first().click();
  // The hold and the starting countdown come first: tap Space (the basic
  // attack) until a few hits show in the events list, then shoot the fight.
  const fighting = await waitUntil(async () => {
    await page.keyboard.press("Space");
    return (await page.getByText(/ acerta /).count()) >= 3;
  }, 30_000);
  if (fighting) {
    await sleep(300);
    await capture.shot(page, "battle-live");
  }
  const ended = await waitUntil(
    async () => (await page.getByText("A batalha acabou").count()) > 0,
    90_000,
  );
  if (ended) {
    await sleep(500);
    await capture.shot(page, "battle-result");
  }
}

/** The lab: three sides, five creeps, every one played by the gambits AI. */
async function lab(page: Page, server: Server, capture: Capture) {
  await page.goto(`${server.base}/lab.html`);
  const form = page.locator("form").first();
  await form.waitFor();
  await form.locator("select").first().selectOption("pedras");
  const add = form.getByRole("button", { name: "+ participante" });
  await add.nth(0).click();
  await add.nth(1).click();
  await form.getByRole("button", { name: "+ lado" }).click();
  // Selects per participant: DNA, HP, gambits, AI; the last one is "you play".
  const selects = form.locator("select");
  await selects.nth(5).selectOption({ label: "▲ triângulo" });
  await selects.nth(13).selectOption({ label: "■ quadrado" });
  await selects.last().selectOption("");
  await form.getByRole("button", { name: "Começar" }).click();
  await waitUntil(
    async () => (await page.getByText(/acerta/).count()) >= 3,
    60_000,
  );
  await sleep(600);
  await capture.shot(page, "lab");
}

/** The replay of the fast world, once it ended, halfway through. */
async function replay(
  page: Page,
  server: Server,
  world: World,
  capture: Capture,
) {
  const ended = await waitUntil(
    async () => (await server.status(world.id)) === "ended",
    240_000,
    1000,
  );
  if (!ended) {
    console.log("  (the fast world did not end in time: skipped)");
    return;
  }
  await page.goto(`${server.base}/?replay=${world.id}`);
  const range = page.locator("input.timeline");
  await range.waitFor();
  const max = Number(await range.getAttribute("max"));
  await range.evaluate(
    (element, value) => {
      const input = element as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(input, String(value));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    },
    Math.floor(max * 0.55),
  );
  await page.waitForFunction(
    () => !document.body.innerText.includes("re-simulando"),
    null,
    { timeout: 120_000 },
  );
  await sleep(1500);
  await capture.shot(page, "replay");
}

async function main(): Promise<void> {
  let options: Options;
  try {
    options = parseOptions(process.argv.slice(2));
  } catch (error) {
    console.error(`${(error as Error).message}\n\n${USAGE}`);
    process.exit(2);
  }
  const { scenes } = options;
  const id = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
  const outDir = new URL(`runs/capture-${id}`, ROOT).pathname;
  mkdirSync(outDir, { recursive: true });

  if (options.build) {
    const build = spawnSync("npm", ["run", "build"], {
      cwd: ROOT,
      stdio: "inherit",
    });
    if (build.status !== 0) throw new Error("the client build failed");
  }

  const server = new Server(options.port, outDir);
  let browser: Browser | null = null;
  try {
    await server.ready();
    const capture = new Capture(outDir);
    browser = await chromium.launch();
    const viewport = { width: options.width, height: options.height };
    const newPage = () => browser!.newPage({ viewport });

    const needFast = scenes.has("world-late") || scenes.has("replay");
    const needSlow = ["world-start", "inspector", "battle"].some((s) =>
      scenes.has(s as Scene),
    );
    // The fast world starts first: it takes the longest to get anywhere.
    const fast = needFast
      ? await server.world(options.seed, FAST_MULTIPLIER, "Ana")
      : null;
    const fastStart = Date.now();
    const fastPage = fast !== null ? await newPage() : null;
    if (fast !== null) await fastPage?.goto(server.tab(fast));
    const slow = needSlow
      ? await server.world(options.seed, SLOW_MULTIPLIER, "Bia")
      : null;

    console.log(`capturing into ${outDir}`);
    if (scenes.has("lobby")) await lobby(await newPage(), server, capture);
    if (slow !== null) {
      const page = await newPage();
      await page.goto(server.tab(slow));
      await worldStart(page, scenes, capture);
      if (scenes.has("battle")) await battle(page, capture);
      await page.close();
    }
    if (scenes.has("lab")) await lab(await newPage(), server, capture);
    if (fast !== null && fastPage !== null && scenes.has("world-late")) {
      // Day 3 of 3: about 0.85 of the world at ×2000.
      await sleep(Math.max(0, 110_000 - (Date.now() - fastStart)));
      await capture.shot(fastPage, "world-late");
    }
    if (fast !== null && scenes.has("replay")) {
      await replay(await newPage(), server, fast, capture);
    }
    console.log(`${capture.shots.length} screenshots in ${outDir}`);
  } finally {
    await browser?.close();
    server.stop();
  }
}

await main();
