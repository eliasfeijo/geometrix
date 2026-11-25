import { viewJson } from "@geometrix/protocol";
import { view } from "@geometrix/sim";
import { afterEach, describe, expect, test } from "vitest";
import { SoakClient } from "../src/soak-client.ts";
import { testApp } from "./helpers.ts";

let close: (() => Promise<void>) | null = null;
const clients: SoakClient[] = [];
afterEach(async () => {
  for (const c of clients.splice(0)) c.stop();
  await close?.();
  close = null;
});

async function until(check: () => boolean, ms = 5_000): Promise<void> {
  const deadline = Date.now() + ms;
  while (!check()) {
    if (Date.now() > deadline) throw new Error("timed out");
    await new Promise((done) => setTimeout(done, 10));
  }
}

async function setup(world: object = { seed: 3 }) {
  const t = await testApp();
  close = t.app.close;
  await t.post("/api/worlds", world);
  const joined = await t.post("/api/worlds/1/join", { name: "Ana", team: 1 });
  const { token } = joined.body as { token: string };
  const host = t.app.worlds.get(1)!;
  host.tick();
  const client = new SoakClient({
    base: t.base.replace("http", "ws"),
    token,
    name: "Ana",
    team: 1,
  });
  clients.push(client);
  await until(() => client.view !== null);
  /** Ticks the world and sends, until the client is at the tick. */
  const advance = async (ticks: number) => {
    for (let i = 0; i < ticks; i++) {
      host.tick();
      t.timers.advance(200);
    }
    await until(() => client.view!.tick === host.state.tick);
  };
  return { ...t, host, client, advance };
}

describe("SoakClient", () => {
  test("follows its team's view and checks its hash", async () => {
    const { host, client, advance } = await setup();
    await advance(130);
    expect(viewJson(client.view!)).toBe(viewJson(view(host.state, 1)));
    expect(client.report).toMatchObject({
      deltas: 130,
      welcomes: { join: 1, reconnect: 0, resync: 0 },
      hashes: { ok: 2, mismatch: 0 },
      errors: [],
    });
  });

  test("resumes after a short drop, without a welcome", async () => {
    const { host, client, advance } = await setup();
    await advance(3);
    client.drop();
    await until(() => client.report.drops === 1);
    for (let i = 0; i < 4; i++) host.tick();
    // The reconnect comes 500 ms later; then the missed deltas, then more.
    await new Promise((done) => setTimeout(done, 700));
    await advance(2);
    expect(viewJson(client.view!)).toBe(viewJson(view(host.state, 1)));
    expect(client.report).toMatchObject({
      drops: 1,
      resumes: 1,
      welcomes: { join: 1, reconnect: 0, resync: 0 },
    });
    const report = client.stop();
    expect(report.bytes).toBeGreaterThan(0);
    expect(report.peakBytesPerSecond).toBeGreaterThan(0);
  });

  test("keeps the team's chronicle, across a drop (M2 encontro C-4)", async () => {
    const { host, client, advance } = await setup({
      seed: 3,
      botTeams: [0, 1],
    });
    while (host.chronicle(1).length < 2) host.tick();
    await advance(1);
    expect(client.chronicle).toEqual(host.chronicle(1));
    expect(client.chronicle.every((e) => !("teams" in e))).toBe(true);
    // The drop resumes from the server's buffer, events included.
    client.drop();
    await until(() => client.report.drops === 1);
    while (host.chronicle(1).length < 4) host.tick();
    await new Promise((done) => setTimeout(done, 700));
    await advance(1);
    expect(client.chronicle).toEqual(host.chronicle(1));
    expect(client.report.resumes).toBe(1);
  }, 20_000);
});
