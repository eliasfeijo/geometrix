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
import type { Difficulty, Player } from "./domination.ts";
import { nearestUnseen } from "./known.ts";
import {
  isRotatedSide,
  manhattan,
  Terrain,
  type Cell,
  type GameMap,
} from "./map.ts";
import { DNAS, type Dna, type Params } from "./params.ts";
import {
  collectorRules,
  raiderRules,
  roadBuilderRules,
  withHelp,
} from "./presets.ts";
import { productionRefusal } from "./production.ts";
import { roadTarget } from "./roads.ts";
import { canonicalJson } from "./serialize.ts";
import {
  isOwnCreep,
  isOwnPlayer,
  ownTeam,
  view,
  type ForeignPlayer,
  type TeamView,
} from "./view.ts";
import type { Creep, Team, WorldState } from "./world.ts";

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
   * The gatherers' posture when approached (see postureRules and
   * standRules): below this HP share they flee; at normal and hard they pay
   * a demand of at most payAtMostPermille of their load (R spec D17).
   */
  posture: { fleeBelowPermille: 400, payAtMostPermille: 250 },
} as const;

/** One bot player per team; player ids are team + 1. */
export type Bot = {
  playerId: number;
  team: number;
  strategist: StrategistId;
  /** Its join's difficulty (R spec D26, plan P8). */
  difficulty: Difficulty;
};

/** The bots of a harness world: one per team, hard unless given (D26). */
export function botsFor(
  strategists: readonly StrategistId[],
  difficulties: readonly Difficulty[] = [],
): Bot[] {
  return strategists.map((strategist, team) => ({
    playerId: team + 1,
    team,
    strategist,
    difficulty: difficulties[team] ?? "hard",
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
      command: {
        type: "join",
        team: bot.team,
        bot: true,
        difficulty: bot.difficulty,
      },
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
 * The commands of the team's bot, from its view, at the difficulty of the
 * team's bot (D26, S-6). Only the size of `size` is read: it may be the
 * world's map.
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

/**
 * The difficulty a team's bot plays at: its first bot player's by id, as
 * the junction's battle reaction reads it (P8); hard with none (D26).
 */
export function teamDifficulty(
  players: readonly (Player | ForeignPlayer)[],
  team: number,
): Difficulty {
  let first: Player | null = null;
  for (const player of players) {
    if (!isOwnPlayer(player) || player.team !== team || !player.bot) continue;
    if (first === null || player.id < first.id) first = player;
  }
  return first?.difficulty ?? "hard";
}

/** The difficulty of the view's team, from its own players. */
const difficultyOf = (seen: TeamView): Difficulty =>
  teamDifficulty(seen.players, seen.team);

/** All a strategist decides from: the team's view and the map it knows. */
type Knowledge = {
  seen: TeamView;
  team: Team;
  map: GameMap;
  /** 1 for each cell the team has seen. */
  explored: number[];
  params: Params;
  /** The difficulty the team's bot plays at (D26). */
  level: Difficulty;
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
    level: difficultyOf(seen),
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
  | { kind: "builder" }
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

/**
 * The enemies the team sees (R spec D18): every creep of another team and
 * every wanderer, whatever the number of teams.
 */
function enemies(seen: TeamView): Cell[] {
  return [
    ...seen.creeps.filter((c) => c.team !== seen.team),
    ...seen.wanderers,
  ];
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
 * The reaction rules the easy bot puts before a gatherer's rules (encontro
 * F3 checkpoint, C2; R spec D26), as the junction reads them (D2): a flee
 * rule refuses an extortion and enters the battle as a carrier; fight, the
 * DNA's preset. The square refuses and fights, entering as a carrier below
 * BALANCED.posture.fleeBelowPermille of its HP; the triangle pays any
 * extortion and enters an attack as a carrier; the circle refuses every
 * extortion and always enters as a carrier. Human players' gatherers keep the
 * defaults (D13).
 */
export function postureRules(dna: Dna): Rule[] {
  const always = { type: "always" } as const;
  switch (dna) {
    case "square":
      return [
        {
          when: {
            type: "hpBelow",
            permille: BALANCED.posture.fleeBelowPermille,
          },
          then: { type: "flee" },
        },
        { when: always, then: { type: "fight" } },
      ];
    case "triangle":
      return [
        { when: always, then: { type: "pay" } },
        { when: always, then: { type: "flee" } },
      ];
    case "circle":
      return [{ when: always, then: { type: "flee" } }];
  }
}

/**
 * The reaction rules the normal and hard bots put before a gatherer's rules,
 * every DNA alike (R spec D17, S-4): pay a demand of at most
 * BALANCED.posture.payAtMostPermille of the load, flee as a carrier below
 * fleeBelowPermille of the HP, refuse and fight with the DNA's preset
 * otherwise. The triangle stops always paying, the circle always fleeing.
 */
export function standRules(): Rule[] {
  const { payAtMostPermille, fleeBelowPermille } = BALANCED.posture;
  return [
    {
      when: { type: "demandAtMost", permille: payAtMostPermille },
      then: { type: "pay" },
    },
    {
      when: { type: "hpBelow", permille: fleeBelowPermille },
      then: { type: "flee" },
    },
    { when: { type: "always" }, then: { type: "fight" } },
  ];
}

/** A gatherer's posture at the bot's difficulty (D17, D26). */
const posture = (dna: Dna, level: Difficulty): Rule[] =>
  level === "easy" ? postureRules(dna) : standRules();

/**
 * The defense rule (R spec D14, S-1): on top of the rules of a creep inside
 * its core zone while an enemy stands there, an attack approach on the
 * enemies within the zone's radius of the creep.
 */
export function defenseRule(params: Params): Rule {
  return {
    when: { type: "always" },
    then: {
      type: "approach",
      intent: "attack",
      radius: params.hp.coreZoneRadius,
      minCargo: 0,
    },
  };
}

/**
 * The creep's rules without the ones the bot puts on top of a role's for a
 * while (the defense rule), so roleOf reads the role underneath.
 */
function withoutWrappers(rules: readonly Rule[], params: Params): Rule[] {
  const defense = canonicalJson(defenseRule(params));
  let at = 0;
  while (at < rules.length && canonicalJson(rules[at]!) === defense) at++;
  return rules.slice(at);
}

/**
 * The rules of the presets without a target, without their reaction rules,
 * as canonical JSON: built once, since roleOf compares every creep with them
 * every minute.
 */
let presetJson: {
  cristal: string;
  raider: string;
  builder: string;
} | null = null;

/** The rules but the reactions and the help rule, which every role has. */
const actionsOf = (rules: readonly Rule[]) =>
  rules.filter(
    (rule) => !isReaction(rule.then) && rule.then.type !== "joinBattle",
  );

/**
 * The role a creep's rules match, leaving out the reaction rules and the
 * rules on top of the role (withoutWrappers); anything else counts as
 * materia.
 */
function roleOf(creep: Pick<Creep, "rules">, params: Params): Role {
  presetJson ??= {
    cristal: canonicalJson(actionsOf(collectorRules("cristal"))),
    raider: canonicalJson(actionsOf(raiderRules())),
    builder: canonicalJson(actionsOf(roadBuilderRules())),
  };
  const actions = actionsOf(withoutWrappers(creep.rules, params));
  const rules = canonicalJson(actions);
  if (rules === presetJson.cristal) return { kind: "cristal" };
  if (rules === presetJson.raider) return { kind: "raider" };
  if (rules === presetJson.builder) return { kind: "builder" };
  return { kind: "materia" };
}

/**
 * The rules the bot gives a creep of `dna` in `role` at its difficulty, each
 * with the DNA's help rule after the reactions (R spec D11, D14, D17).
 */
function rulesFor(role: Role, dna: Dna, level: Difficulty): Rule[] {
  switch (role.kind) {
    case "raider":
      return withHelp(raiderRules(), dna);
    case "materia":
      return withHelp(
        [...posture(dna, level), ...collectorRules("materia")],
        dna,
      );
    case "cristal":
      return withHelp(
        [...posture(dna, level), ...collectorRules("cristal")],
        dna,
      );
    case "builder":
      return withHelp([...posture(dna, level), ...roadBuilderRules()], dna);
  }
}

/**
 * Moves creeps between roles to reach the balanced split. Creeps leaving a
 * role that has too many are taken lowest id first, and so are the materia
 * creeps that fill a role short of creeps: cristal, then the road builder,
 * then the raiders.
 */
function assignRoles(known: Knowledge): Command[] {
  const { seen, team, map, explored, params, level } = known;
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

  const roles = new Map(creeps.map((c) => [c, roleOf(c, params)]));
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
  fill({ kind: "builder" }, wantBuilders);
  fill({ kind: "raider" }, wantRaiders);

  // Defense (D14, normal and hard): while an enemy stands in the core zone,
  // the creeps inside it attack on top of their role.
  const inZone = (cell: Cell) =>
    manhattan(cell, team.core) <= params.hp.coreZoneRadius;
  const defending = level !== "easy" && enemies(seen).some(inZone);

  // A raider gets its preset; a gatherer, its role's preset behind its
  // posture (setRules), also when only the posture is missing (a newborn).
  const commands: Command[] = [];
  for (const creep of creeps) {
    const role = next.get(creep)!;
    const base = rulesFor(role, creep.dna, level);
    const defends = defending && creep.dominatedBy === null && inZone(creep);
    const rules = defends ? [defenseRule(params), ...base] : base;
    if (canonicalJson(creep.rules) === canonicalJson(rules)) continue;
    commands.push(
      role.kind === "raider" && !defends
        ? { type: "applyPreset", creepId: creep.id, preset: "raider" }
        : { type: "setRules", creepId: creep.id, rules },
    );
  }
  return commands;
}
