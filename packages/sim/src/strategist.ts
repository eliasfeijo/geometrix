// Bot strategists (plan section 9; balanced decided by the owner in F5,
// 2026-11-13). A strategist is a team policy that issues the same external
// commands a human would (produce, buyUpgrade, applyPreset). It decides from
// its team's view and the params alone (M1.5 spec V-3, fog spec B-1: a bot
// knows no more than a human of the team, ADR-0006 rule 2), with no memory of
// its own, so a run restored from a snapshot or replayed from the log takes the
// same decisions. It has no scouting logic: exploring is up to the presets
// (fog plan N8). The harness
// runs it for every team; a server world may give each team one bot (spec
// section 5, F6 details). Its commands go into the log like a human's.

import { isReaction, type Rule } from "./autopilot.ts";
import { canAfford } from "./economy.ts";
import type { Command, CommandInput } from "./commands.ts";
import { nearestUnseen } from "./known.ts";
import {
  isRotatedSide,
  manhattan,
  Terrain,
  type Cell,
  type GameMap,
} from "./map.ts";
import { DNAS, type Dna, type Params } from "./params.ts";
import { collectorRules, raiderRules, roadBuilderRules } from "./presets.ts";
import { productionRefusal } from "./production.ts";
import { nextSegment, type RoadContext } from "./roads.ts";
import { canonicalJson } from "./serialize.ts";
import { isOwnCreep, ownTeam, view, type TeamView } from "./view.ts";
import type { Creep, Deposit, Team, WorldState } from "./world.ts";

export const STRATEGISTS = ["balanced", "none"] as const;
export type StrategistId = (typeof STRATEGISTS)[number];

/** The balanced strategist's settings, printed in report.md. Provisional. */
export const BALANCED = {
  /** Acts once per world minute. */
  everyTicks: 60,
  /**
   * Share of the team's creeps gathering cristal while there may be any: the
   * team knows a cristal deposit with some left, or can still reach cells it
   * never saw (the cristal collectors explore for it, fog spec A-4).
   */
  cristalShare: { numerator: 1, denominator: 3 },
  /** Creeps building roads while some deposit still lacks one. */
  builders: 1,
  /**
   * Share of the team's creeps raiding, rounded down (M2 encontro spec D15,
   * plan P8): they extort loaded enemies in sight. Only while the team can
   * still reach a cell never seen (F3 checkpoint, C1).
   */
  raiderShare: { numerator: 1, denominator: 6 },
  /**
   * The gatherers' posture when approached, by DNA (F3 checkpoint, C2; see
   * postureRules): below this HP share any of them flees, and the triangle
   * pays a demand up to this share of its cargo.
   */
  posture: { fleeBelowPermille: 400, triangleMaxDemandPermille: 500 },
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

/** The map's size, all a client gets of it in the welcome (fog plan section 8). */
export type MapSize = Pick<GameMap, "width" | "height">;

/**
 * The commands of the team's bot, from its view. Only the size of `size` is
 * read: it may be the world's map.
 */
export function strategistCommands(
  id: StrategistId,
  seen: TeamView,
  size: MapSize,
  params: Params,
): Command[] {
  switch (id) {
    case "balanced":
      return balanced(knowledge(seen, size, params));
    case "none":
      return [];
  }
}

/** All a strategist decides from: the team's view and the map it knows. */
type Knowledge = {
  seen: TeamView;
  team: Team;
  map: GameMap;
  /** 1 for each cell the team has seen. */
  explored: number[];
  params: Params;
};

/**
 * The map the team knows, from the view: terrain never seen counts as
 * passable jungle, as in the sim's known map (known.ts).
 */
function knowledge(
  seen: TeamView,
  { width, height }: MapSize,
  params: Params,
): Knowledge {
  const terrain = seen.known.map((t) =>
    t === -1 ? Terrain.jungle : (t as Terrain),
  );
  const road: number[] = new Array<number>(terrain.length).fill(0);
  for (const i of seen.roads) road[i] = 1;
  return {
    seen,
    team: ownTeam(seen),
    map: { width, height, terrain, road },
    explored: seen.known.map((t) => (t === -1 ? 0 : 1)),
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
  | { kind: "materia" }
  | { kind: "cristal" }
  | { kind: "builder"; target: Cell }
  | { kind: "raider" };

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

/**
 * The reaction rules the bot puts before a gatherer's rules (F3 checkpoint,
 * C2): the square refuses an extortion and fights, the triangle pays a
 * small demand and flees otherwise, the circle always flees. Below
 * BALANCED.posture.fleeBelowPermille of its HP any of them flees. The rules
 * cannot tell the dialogue from the fight: a triangle or a circle tries to
 * flee in every round too. Human players' gatherers keep the defaults (D13).
 */
export function postureRules(dna: Dna): Rule[] {
  const { fleeBelowPermille, triangleMaxDemandPermille } = BALANCED.posture;
  const always = { type: "always" } as const;
  const fleeBelow: Rule = {
    when: { type: "hpBelow", permille: fleeBelowPermille },
    then: { type: "flee" },
  };
  switch (dna) {
    case "square":
      return [fleeBelow, { when: always, then: { type: "fight" } }];
    case "triangle":
      return [
        fleeBelow,
        {
          when: { type: "demandAtMost", permille: triangleMaxDemandPermille },
          then: { type: "pay" },
        },
        { when: always, then: { type: "flee" } },
      ];
    case "circle":
      return [{ when: always, then: { type: "flee" } }];
  }
}

/**
 * The rules of the presets without a target, without their reaction rules,
 * as canonical JSON: built once, since roleOf compares every creep with them
 * every minute.
 */
let presetJson: { cristal: string; raider: string } | null = null;

const actionsOf = (rules: readonly Rule[]) =>
  rules.filter((rule) => !isReaction(rule.then));

/**
 * The role a creep's rules match, leaving out the reaction rules; anything
 * else counts as materia.
 */
function roleOf(creep: Pick<Creep, "rules">): Role {
  presetJson ??= {
    cristal: canonicalJson(collectorRules("cristal")),
    raider: canonicalJson(actionsOf(raiderRules())),
  };
  const actions = actionsOf(creep.rules);
  const rules = canonicalJson(actions);
  if (rules === presetJson.cristal) return { kind: "cristal" };
  if (rules === presetJson.raider) return { kind: "raider" };
  const build = actions[1]?.then;
  if (
    build?.type === "buildRoad" &&
    rules === canonicalJson(roadBuilderRules(build))
  ) {
    return { kind: "builder", target: { x: build.x, y: build.y } };
  }
  return { kind: "materia" };
}

/** The rules the bot gives a creep of `dna` in `role`. */
function rulesFor(role: Role, dna: Dna): Rule[] {
  switch (role.kind) {
    case "raider":
      return raiderRules();
    case "materia":
      return [...postureRules(dna), ...collectorRules("materia")];
    case "cristal":
      return [...postureRules(dna), ...collectorRules("cristal")];
    case "builder":
      return [...postureRules(dna), ...roadBuilderRules(role.target)];
  }
}

/**
 * The road target: the non-empty deposit nearest to the core (Manhattan, ties
 * to the first cell in the team's frame, as explore: the deposit ids are not
 * mirrored between the teams) without a road on its cell and with a segment
 * that can be built toward it. null when there is none.
 */
export function roadTarget(
  state: RoadContext & { deposits: readonly Deposit[] },
  team: Pick<Team, "id" | "core">,
): Cell | null {
  const { map } = state;
  const { width, height } = map;
  const frameIndex = (c: Cell) =>
    isRotatedSide(team.id)
      ? (height - 1 - c.y) * width + (width - 1 - c.x)
      : c.y * width + c.x;
  const candidates = state.deposits
    .filter((d) => d.amount > 0 && map.road[d.y * map.width + d.x] === 0)
    .sort(
      (a, b) =>
        manhattan(team.core, a) - manhattan(team.core, b) ||
        frameIndex(a) - frameIndex(b),
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
 * creeps that fill a role short of creeps: cristal, then the road builder,
 * then the raiders.
 */
function assignRoles(known: Knowledge): Command[] {
  const { seen, team, map, explored, params } = known;
  const creeps = seen.creeps
    .filter(isOwnCreep)
    .filter((c) => c.team === team.id);
  // Some cell never seen is within the team's reach.
  const canExplore =
    nearestUnseen(map, explored, team.core, isRotatedSide(team.id)) !== null;
  const hasCristal =
    seen.deposits.some((d) => d.kind === "cristal" && d.amount > 0) ||
    canExplore;
  const { numerator, denominator } = BALANCED.cristalShare;
  const wantCristal = hasCristal
    ? Math.floor((creeps.length * numerator + denominator - 1) / denominator)
    : 0;
  // The cores the team knows of: its own and the ones it has seen.
  const teams = seen.teams.flatMap((t) =>
    t.core === null ? [] : [{ core: t.core }],
  );
  const target = roadTarget(
    { map, params, teams, deposits: seen.deposits },
    team,
  );
  const wantBuilders = target === null ? 0 : BALANCED.builders;
  // With nothing left to explore, a raider would only wait at its core
  // (encontro F3 checkpoint, C1): it goes back to gathering.
  const raiders = BALANCED.raiderShare;
  const wantRaiders = canExplore
    ? Math.floor((creeps.length * raiders.numerator) / raiders.denominator)
    : 0;

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
  trim("raider", wantRaiders);
  fill({ kind: "cristal" }, wantCristal);
  if (target !== null) {
    for (const creep of inRole("builder"))
      next.set(creep, { kind: "builder", target });
    fill({ kind: "builder", target }, wantBuilders);
  }
  fill({ kind: "raider" }, wantRaiders);

  // A raider gets its preset; a gatherer, its role's preset behind its
  // posture (setRules), also when only the posture is missing (a newborn).
  const commands: Command[] = [];
  for (const creep of creeps) {
    const role = next.get(creep)!;
    const rules = rulesFor(role, creep.dna);
    if (canonicalJson(creep.rules) === canonicalJson(rules)) continue;
    commands.push(
      role.kind === "raider"
        ? { type: "applyPreset", creepId: creep.id, preset: "raider" }
        : { type: "setRules", creepId: creep.id, rules },
    );
  }
  return commands;
}
