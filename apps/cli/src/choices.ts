// The bots' choices in a run (R spec §7, F3): read from the accepted
// commands of the log, as the rules each bot gave its creeps. A setRules is
// sent only when a creep's rules change, so the counts are the bot's
// decisions, not its ticks.

import {
  canonicalJson,
  defenseRule,
  responseOf,
  type Params,
  type Player,
  type Rule,
} from "@geometrix/sim";
import type { LoggedCommand } from "./harness.ts";

export type TeamChoices = {
  team: number;
  /** D27: threats the bot answered with help (one or more helpers). */
  help: number;
  /** The helpers it sent to them. */
  helpers: number;
  /** D27: threats it answered by paying, dropping and fleeing, dropping and fighting. */
  pay: number;
  dropFlee: number;
  dropFight: number;
  /** D16: creeps put to follow a raider or an escorted collector. */
  followers: number;
  /** D14: creeps put on the core zone's defense. */
  defense: number;
  /** D27: creeps sent to pick the spoils up after a fight. */
  pickups: number;
};

const isFollow = (rule: Rule) =>
  rule.when.type === "always" && rule.then.type === "follow";
const followed = (rule: Rule | undefined) =>
  rule !== undefined && isFollow(rule) && rule.then.type === "follow"
    ? rule.then.creepId
    : null;

/** Each team's choices, from the bots' setRules in `log`. */
export function strategistChoices(
  log: readonly LoggedCommand[],
  players: readonly Player[],
  teams: number,
  params: Params,
): TeamChoices[] {
  const tally = Array.from({ length: teams }, (_, team): TeamChoices => ({
    team,
    help: 0,
    helpers: 0,
    pay: 0,
    dropFlee: 0,
    dropFight: 0,
    followers: 0,
    defense: 0,
    pickups: 0,
  }));
  const botTeam = new Map(
    players.filter((p) => p.bot).map((p) => [p.id, p.team]),
  );
  const defense = canonicalJson(defenseRule(params));
  /** Each creep's last leader, and whether it was defending or picking. */
  const leaderOf = new Map<number, number | null>();
  const defending = new Map<number, boolean>();
  const picking = new Map<number, boolean>();
  /** Victims helped, by tick: one choice however many helpers. */
  const helped = new Set<string>();
  for (const { tick, playerId, command } of log) {
    if (command.type !== "setRules") continue;
    const team = botTeam.get(playerId);
    if (team === undefined) continue;
    const t = tally[team]!;
    const { creepId, rules } = command;
    const victim = followed(rules[0]);
    if (victim !== null) {
      t.helpers += 1;
      if (!helped.has(`${tick}:${victim}`)) {
        helped.add(`${tick}:${victim}`);
        t.help += 1;
      }
      continue;
    }
    const response = responseOf(rules);
    if (response !== null) {
      t[response] += 1;
      continue;
    }
    const first = rules[0];
    const picks = rules.some(
      (r) => r.when.type === "always" && r.then.type === "pickup",
    );
    if (picks && picking.get(creepId) !== true) t.pickups += 1;
    picking.set(creepId, picks);
    const defends = first !== undefined && canonicalJson(first) === defense;
    if (defends && defending.get(creepId) !== true) t.defense += 1;
    defending.set(creepId, defends);
    const leader = rules.find(isFollow);
    const id = leader === undefined ? null : followed(leader);
    if (id !== null && leaderOf.get(creepId) !== id) t.followers += 1;
    leaderOf.set(creepId, id);
  }
  return tally;
}
