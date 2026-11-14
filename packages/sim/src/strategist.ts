// Bot strategists (plan section 9; balanced decided by the owner in F5,
// 2026-11-13). A strategist is a team policy that issues the same external
// commands a human would (produce, buyUpgrade, applyPreset). It decides from
// its team's view, the static map and the params alone (M1.5 spec V-3: a bot
// knows no more than a human of the team, ADR-0006 rule 2), with no memory of
// its own, so a run restored from a snapshot or replayed from the log takes the
// same decisions. The harness
// runs it for every team; a server world may give each team one bot (spec
// section 5, F6 details). Its commands go into the log like a human's.

import { canAfford } from "./economy.ts";
import type { Command, CommandInput } from "./commands.ts";
import { manhattan, type Cell, type GameMap } from "./map.ts";
import { DNAS, type Dna, type Params } from "./params.ts";
import { collectorRules, roadBuilderRules } from "./presets.ts";
import { productionRefusal } from "./production.ts";
import { nextSegment, type RoadContext } from "./roads.ts";
import { canonicalJson } from "./serialize.ts";
import { view, type TeamView } from "./view.ts";
import type { Creep, Deposit, Team, WorldState } from "./world.ts";

export const STRATEGISTS = ["balanced", "none"] as const;
export type StrategistId = (typeof STRATEGISTS)[number];

/** The balanced strategist's settings, printed in report.md. Provisional. */
export const BALANCED = {
  /** Acts once per world minute. */
  everyTicks: 60,
  /** Share of the team's creeps gathering cristal while there is any. */
  cristalShare: { numerator: 1, denominator: 3 },
  /** Creeps building roads while some deposit still lacks one. */
  builders: 1,
} as const;

/** One bot player per team; player ids are team + 1. */
export type Bot = {
  playerId: number;
  team: number;
  strategist: StrategistId;
};

export function botsFor(strategists: readonly StrategistId[]): Bot[] {
  return strategists.map((strategist, team) => ({
    playerId: team + 1,
    team,
    strategist,
  }));
}

/** What the bots send on this tick: their join at tick 0, then decisions. */
export function botCommands(
  state: WorldState,
  bots: readonly Bot[],
): CommandInput[] {
  if (state.tick === 0) {
    return bots.map((bot) => ({
      playerId: bot.playerId,
      command: { type: "join", team: bot.team, bot: true },
    }));
  }
  if (!strategistActs(state.tick)) return [];
  return bots.flatMap((bot) =>
    strategistCommands(
      bot.strategist,
      view(state, bot.team),
      state.map,
      state.params,
    ).map((command) => ({
      playerId: bot.playerId,
      command,
    })),
  );
}

/** The terrain every client gets in the welcome; roads come from the view. */
export type StaticMap = Omit<GameMap, "road">;

/**
 * The commands of the team's bot. `map` may be the world's map: its road
 * layer is ignored and rebuilt from `seen.roads`.
 */
export function strategistCommands(
  id: StrategistId,
  seen: TeamView,
  map: StaticMap,
  params: Params,
): Command[] {
  switch (id) {
    case "balanced":
      return balanced(knowledge(seen, map, params));
    case "none":
      return [];
  }
}

/** All a strategist decides from: the team's view on the static map. */
type Knowledge = {
  seen: TeamView;
  team: Team;
  map: GameMap;
  params: Params;
};

function knowledge(seen: TeamView, map: StaticMap, params: Params): Knowledge {
  const road: number[] = new Array<number>(map.terrain.length).fill(0);
  for (const i of seen.roads) road[i] = 1;
  const { width, height, terrain } = map;
  return {
    seen,
    team: seen.teams[seen.team]!,
    map: { width, height, terrain, road },
    params,
  };
}

/**
 * Whether bots act on this tick: the tick after they join (tick 0), then once
 * every BALANCED.everyTicks.
 */
export function strategistActs(tick: number): boolean {
  return tick % BALANCED.everyTicks === 1 % BALANCED.everyTicks;
}

type Role =
  { kind: "materia" } | { kind: "cristal" } | { kind: "builder"; target: Cell };

function balanced(known: Knowledge): Command[] {
  const commands: Command[] = [];
  const { seen, team, params } = known;
  const stock = { ...team.stock };

  if (productionRefusal({ params, creeps: seen.creeps }, team) === null) {
    commands.push({
      type: "produce",
      dna: scarcestDna(seen, team),
      repeat: false,
    });
    stock.materia -= params.creep.cost.materia;
    stock.cristal -= params.creep.cost.cristal;
  }
  if (
    !team.upgrades.capacity &&
    canAfford(stock, params.upgrade.capacity.cost)
  ) {
    commands.push({ type: "buyUpgrade", upgrade: "capacity" });
  }
  commands.push(...assignRoles(known));
  return commands;
}

/** The DNA the team has fewest creeps of; ties in DNAS order (■ ▲ ●). */
function scarcestDna(seen: TeamView, team: Team): Dna {
  const counts = DNAS.map(
    (dna) =>
      seen.creeps.filter((c) => c.team === team.id && c.dna === dna).length,
  );
  return DNAS[counts.indexOf(Math.min(...counts))]!;
}

/** The role a creep's rules match; anything else counts as materia. */
function roleOf(creep: Pick<Creep, "rules">): Role {
  const rules = canonicalJson(creep.rules);
  if (rules === canonicalJson(collectorRules("cristal")))
    return { kind: "cristal" };
  const build = creep.rules[1]?.then;
  if (
    build?.type === "buildRoad" &&
    rules === canonicalJson(roadBuilderRules(build))
  ) {
    return { kind: "builder", target: { x: build.x, y: build.y } };
  }
  return { kind: "materia" };
}

/**
 * The road target: the non-empty deposit nearest to the core (Manhattan, ties
 * to the lower id) without a road on its cell and with a segment that can be
 * built toward it. null when there is none.
 */
export function roadTarget(
  state: RoadContext & { deposits: readonly Deposit[] },
  team: Pick<Team, "id" | "core">,
): Cell | null {
  const { map } = state;
  const candidates = state.deposits
    .filter((d) => d.amount > 0 && map.road[d.y * map.width + d.x] === 0)
    .sort(
      (a, b) =>
        manhattan(team.core, a) - manhattan(team.core, b) || a.id - b.id,
    );
  for (const deposit of candidates) {
    if (nextSegment(state, team, deposit) !== null) {
      return { x: deposit.x, y: deposit.y };
    }
  }
  return null;
}

/**
 * Moves creeps between roles to reach the balanced split. Creeps leaving a
 * role that has too many are taken lowest id first, and so are the materia
 * creeps that fill a role short of creeps.
 */
function assignRoles(known: Knowledge): Command[] {
  const { seen, team, map, params } = known;
  const creeps = seen.creeps.filter((c) => c.team === team.id);
  const hasCristal = seen.deposits.some(
    (d) => d.kind === "cristal" && d.amount > 0,
  );
  const { numerator, denominator } = BALANCED.cristalShare;
  const wantCristal = hasCristal
    ? Math.floor((creeps.length * numerator + denominator - 1) / denominator)
    : 0;
  const target = roadTarget(
    { map, params, teams: seen.teams, deposits: seen.deposits },
    team,
  );
  const wantBuilders = target === null ? 0 : BALANCED.builders;

  const roles = new Map(creeps.map((c) => [c, roleOf(c)]));
  const next = new Map(roles);
  const inRole = (kind: Role["kind"]) =>
    creeps.filter((c) => next.get(c)!.kind === kind);

  const trim = (kind: Role["kind"], want: number) => {
    const members = inRole(kind);
    for (const creep of members.slice(0, Math.max(0, members.length - want))) {
      next.set(creep, { kind: "materia" });
    }
  };
  const fill = (role: Role, want: number) => {
    const missing = want - inRole(role.kind).length;
    for (const creep of inRole("materia").slice(0, Math.max(0, missing))) {
      next.set(creep, role);
    }
  };
  trim("builder", wantBuilders);
  trim("cristal", wantCristal);
  fill({ kind: "cristal" }, wantCristal);
  if (target !== null) {
    for (const creep of inRole("builder"))
      next.set(creep, { kind: "builder", target });
    fill({ kind: "builder", target }, wantBuilders);
  }

  const commands: Command[] = [];
  for (const creep of creeps) {
    const role = next.get(creep)!;
    if (canonicalJson(role) === canonicalJson(roles.get(creep))) continue;
    switch (role.kind) {
      case "materia":
        commands.push({
          type: "applyPreset",
          creepId: creep.id,
          preset: "materiaCollector",
        });
        break;
      case "cristal":
        commands.push({
          type: "applyPreset",
          creepId: creep.id,
          preset: "cristalCollector",
        });
        break;
      case "builder":
        commands.push({
          type: "applyPreset",
          creepId: creep.id,
          preset: "roadBuilder",
          target: role.target,
        });
        break;
    }
  }
  return commands;
}
