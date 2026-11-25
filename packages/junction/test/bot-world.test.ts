// Behavior lock for the strategist and the battles (M1.5 rede plan section 7,
// spec D4; junction plan section 4): a seed-42 world with one balanced bot per
// team, run for 6 world hours through the junction host, the way the harness
// and the server run it. A changed hash means a bot or a battle decided
// something different; it changes on purpose with the fog (fog spec D12),
// with the raiders (M2 encontro spec D15, D20), with their minimum target
// cargo (plan C11) and with the battles (junction F3).

import { createHash } from "node:crypto";
import {
  botCommands,
  botsFor,
  createWorld,
  serialize,
  validate,
} from "@geometrix/sim";
import { expect, test } from "vitest";
import { createHost, serializeHost, stepJunction } from "../src/host.ts";
import { loadBattleParams, loadTestParams } from "./helpers.ts";

const HOURS = 6;

test("a 6 h bot world of seed 42 through the host hashes to a stable value", () => {
  const params = loadTestParams();
  const state = createWorld(42, params);
  const host = createHost(loadBattleParams());
  const ticks = (HOURS * 3600) / params.world.tickSeconds;
  const bots = botsFor(["balanced", "balanced"]);
  let commands = 0;
  let battles = 0;
  let ended = 0;
  while (state.tick < ticks) {
    const accepted = botCommands(state, bots).filter(
      ({ playerId, command }) => validate(state, command, playerId) === null,
    );
    commands += accepted.length;
    const done = stepJunction(state, host, accepted);
    battles += done.events.filter((e) => e.type === "battleOpened").length;
    ended += done.finished.length;
  }
  // The bots did act: production, upgrades and role changes; and fought.
  expect(state.creeps.length).toBeGreaterThan(12);
  expect(commands).toBeGreaterThan(20);
  expect(battles).toBeGreaterThan(0);
  expect(ended).toBeGreaterThanOrEqual(battles - host.instances.length);
  const hash = createHash("sha256")
    .update(serialize(state))
    .update(serializeHost(host))
    .digest("hex");
  expect(hash).toMatchInlineSnapshot(
    `"67edf7e51ab64f127dd716b40125fd68b1d96e58c747387609e795cc958322b7"`,
  );
  // Growing to the population cap, with raiders exploring, the world takes
  // over 10 s alone and some 30 s with the whole suite running.
}, 60_000);
