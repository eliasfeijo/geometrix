import { readFileSync } from "node:fs";
import {
  defenseRule,
  dropFightRules,
  dropFleeRules,
  followerRules,
  helperRule,
  parseParams,
  payRules,
  standRules,
  type Command,
  type Player,
  type Rule,
} from "@geometrix/sim";
import { describe, expect, test } from "vitest";
import { strategistChoices } from "../src/choices.ts";
import type { LoggedCommand } from "../src/harness.ts";

const params = parseParams(
  JSON.parse(
    readFileSync(
      new URL("../../../packages/sim/test/params.json", import.meta.url),
      "utf8",
    ),
  ),
);

// Two bot players and a human on team 1, whose commands do not count.
const players = [
  { id: 1, team: 0, bot: true },
  { id: 2, team: 1, bot: true },
  { id: 3, team: 1, bot: false },
] as Player[];

const pickup: Rule = { when: { type: "always" }, then: { type: "pickup" } };

function logOf(entries: [number, number, number, Rule[]][]): LoggedCommand[] {
  return entries.map(([tick, playerId, creepId, rules], seq) => ({
    tick,
    seq,
    playerId,
    command: { type: "setRules", creepId, rules } satisfies Command,
  }));
}

describe("strategistChoices", () => {
  test("reads each D27 choice, the groups, the defense and the pickups from the bots' rules", () => {
    const base = standRules();
    const log = logOf([
      // Tick 10: one threat answered with two helpers on victim 50.
      [10, 1, 11, [helperRule(50), ...base]],
      [10, 1, 12, [helperRule(50), ...base]],
      [11, 1, 13, payRules()],
      [12, 1, 14, dropFleeRules()],
      [12, 2, 15, dropFightRules()],
      // Creep 16 follows leader 20, gets the defense on top, then off: one
      // follower and one defense.
      [60, 2, 16, followerRules(20, "square")],
      [120, 2, 16, [defenseRule(params), ...followerRules(20, "square")]],
      [180, 2, 16, followerRules(20, "square")],
      // Then another leader: a second follower.
      [240, 2, 16, followerRules(21, "square")],
      // Creep 15 picks up after its fight, twice in a row: one pickup.
      [60, 2, 15, [pickup, ...base]],
      [120, 2, 15, [defenseRule(params), pickup, ...base]],
      // The human's rules are not the bot's.
      [61, 3, 17, payRules()],
    ]);
    const [t0, t1] = strategistChoices(log, players, 2, params);
    expect(t0).toEqual({
      team: 0,
      help: 1,
      helpers: 2,
      pay: 1,
      dropFlee: 1,
      dropFight: 0,
      followers: 0,
      defense: 0,
      pickups: 0,
    });
    expect(t1).toEqual({
      team: 1,
      help: 0,
      helpers: 0,
      pay: 0,
      dropFlee: 0,
      dropFight: 1,
      followers: 2,
      defense: 2,
      pickups: 1,
    });
  });
});
