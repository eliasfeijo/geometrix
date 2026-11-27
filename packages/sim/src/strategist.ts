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
  helpRule,
  raiderRules,
  roadBuilderRules,
  withHelp,
} from "./presets.ts";
import { productionRefusal } from "./production.ts";
import { roadTarget } from "./roads.ts";
import { canonicalJson } from "./serialize.ts";
import {
  choose,
  choosesFor,
  dropFightRules,
  dropFleeRules,
  helperRule,
  payRules,
  responseOf,
  RISK,
  threatsIn,
  type Threat,
} from "./threat.ts";
import {
  isOwnCreep,
  isOwnPlayer,
  ownTeam,
  view,
  type CreepView,
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
   * At normal and hard the raider role is a group (R spec D16, S-3): one
   * raider and `followers` following it, from `minCreeps` creeps on and
   * while the team can still explore (raiderShare is the easy bot's).
   */
  raidGroup: { minCreeps: 8, followers: 2 },
  /** One cristal collector's escort at normal and hard (D16). */
  escort: { minCreeps: 10, followers: 1 },
  /**
   * The gatherers' posture when approached (see postureRules and
   * standRules): below this HP share they flee; at normal and hard they pay
   * a demand of at most payAtMostPermille of their load (R spec D17).
   */
  posture: {
    fleeBelowPermille: 400,
    payAtMostPermille: RISK.payAtMostPermille,
  },
  /** The hard bot's encounter choices (D27): see threat.ts. */
  risk: RISK,
  /**
   * With no human in its team, at most this many creeps, nothing in
   * production and a stock below a creep's cost, the bot concedes, at every
   * difficulty (E-min D4).
   */
  concedeAtCreeps: 1,
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
  const acts = strategistActs(state.tick);
  return bots.flatMap((bot) => {
    // The full decision once a minute; between them, the hard bot's threat
    // pass on every tick (P9), as the server runs it.
    const commands = acts
      ? strategistCommands(
          bot.strategist,
          view(state, bot.team),
          state.map,
          state.params,
        )
      : bot.strategist === "balanced"
        ? threatPass(state, bot.team)
        : [];
    return commands.map((command) => ({ playerId: bot.playerId, command }));
  });
}

/**
 * The threat pass of the team's bot on a tick without a full decision (R
 * spec D27, S-7, plan P9): at hard, the D27 choice for each loaded creep an
 * enemy in sight newly chases. It decides from the team's view; the state is
 * read only to skip building the view on a tick when no creep or wanderer of
 * another side is approaching one of the team's creeps, which the view would
 * show as no threat.
 */
export function threatPass(state: WorldState, team: number): Command[] {
  if (teamDifficulty(state.players, team) !== "hard") return [];
  const own = new Set<number>();
  for (const creep of state.creeps) if (creep.team === team) own.add(creep.id);
  const chased = (order: { type: string; targetId?: number }) =>
    order.type === "approach" && own.has(order.targetId!);
  if (
    !state.creeps.some((c) => c.team !== team && chased(c.order)) &&
    !state.wanderers.some((w) => chased(w.order))
  ) {
    return [];
  }
  return threatCommands(view(state, team), state.map, state.params);
}

/**
 * The hard bot's threat pass from its view (D27): the rules of each new
 * threat's victim and helpers; nothing below hard.
 */
export function threatCommands(
  seen: TeamView,
  size: MapSize,
  params: Params,
): Command[] {
  if (ownTeam(seen).out !== null || difficultyOf(seen) !== "hard") return [];
  const threats = threatsIn(seen);
  const own = ownCreeps(seen);
  if (!threats.some((t) => isNew(t, own))) return [];
  return respond(knowledge(seen, size, params), threats).commands;
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
      // A team out sends nothing (E-min B-2); a lost match is conceded (B-1).
      if (ownTeam(seen).out !== null) return [];
      if (givesUp(seen, params)) return [{ type: "concede" }];
      return balanced(knowledge(seen, size, params));
    case "none":
      return [];
  }
}

/**
 * Whether the match is lost for a team of bots alone (E-min D4): from the
 * view, and only the core's stock counts, not what the last creep carries.
 * Where a human plays, they decide.
 */
function givesUp(seen: TeamView, params: Params): boolean {
  const team = ownTeam(seen);
  return (
    !seen.players.some((p) => p.team === seen.team && !p.bot) &&
    team.production === null &&
    !canAfford(team.stock, params.creep.cost) &&
    ownCreeps(seen).length <= BALANCED.concedeAtCreeps
  );
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
  | { kind: "raider" }
  /** A raid group's member or an escort (D16): follows `leader`. */
  | { kind: "follower"; leader: number };

function balanced(known: Knowledge): Command[] {
  const commands: Command[] = [];
  const { seen, team, params, level } = known;
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
  // At hard, the threats first: their victims and helpers keep their rules
  // while the threat lasts (D27).
  const pass =
    level === "hard"
      ? respond(known, threatsIn(seen))
      : { commands: [], locked: new Set<number>() };
  commands.push(...assignRoles(known, pass.locked), ...pass.commands);
  return commands;
}

/** The team's own creeps in its view, by id. */
const ownCreeps = (seen: TeamView): CreepView[] =>
  seen.creeps.filter(
    (c): c is CreepView => isOwnCreep(c) && c.team === seen.team,
  );

/** The ids a creep's follow order and follow rules point at. */
function followTargets(creep: CreepView): number[] {
  const targets = creep.rules.flatMap((r) =>
    r.then.type === "follow" ? [r.then.creepId] : [],
  );
  if (creep.order.type === "follow") targets.push(creep.order.targetId);
  return targets;
}

/**
 * Whether the bot still has to choose for this threat (D27): a loaded free
 * victim with no response rules and no teammate following it (a helper, a
 * raid group's member or an escort already on its way).
 */
function isNew(threat: Threat, own: readonly CreepView[]): boolean {
  const { victim } = threat;
  if (!choosesFor(victim) || responseOf(victim.rules) !== null) return false;
  return !own.some(
    (c) => c.id !== victim.id && followTargets(c).includes(victim.id),
  );
}

/**
 * The threat pass (D27): the creeps it holds while their threat lasts (each
 * victim, and each helper whose first rule follows one), and the rules of
 * the choice for each new threat. A helper is a free teammate not held, that
 * no chain of follows leads back from the victim to (F-5).
 */
function respond(
  known: Knowledge,
  threats: readonly Threat[],
): { commands: Command[]; locked: Set<number> } {
  const { seen, map, params, level } = known;
  const own = ownCreeps(seen);
  const victims = new Set(threats.map((t) => t.victim.id));
  // A victim the bot does not choose for (empty, or in an encounter with no
  // response) keeps taking its role's and the defense's rules.
  const locked = new Set(
    threats
      .filter(
        ({ victim }) => choosesFor(victim) || responseOf(victim.rules) !== null,
      )
      .map((t) => t.victim.id),
  );
  for (const creep of own) {
    const first = creep.rules[0]?.then;
    if (first?.type === "follow" && victims.has(first.creepId)) {
      locked.add(creep.id);
    }
  }
  const follows = new Map(own.map((c) => [c.id, followTargets(c)]));
  const leadsTo = (from: number, to: number) => {
    const seenIds = new Set<number>();
    const pending = [from];
    while (pending.length > 0) {
      const id = pending.pop()!;
      if (id === to) return true;
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      pending.push(...(follows.get(id) ?? []));
    }
    return false;
  };
  const commands: Command[] = [];
  for (const threat of threats) {
    if (!isNew(threat, own)) continue;
    const { victim } = threat;
    const candidates = own.filter(
      (c) =>
        !locked.has(c.id) &&
        c.engagement === null &&
        c.battle === null &&
        c.dominatedBy === null &&
        !leadsTo(victim.id, c.id),
    );
    const choice = choose(threat, candidates, map, params);
    if (choice.kind !== "help") {
      const rules =
        choice.kind === "pay"
          ? payRules()
          : choice.kind === "dropFlee"
            ? dropFleeRules()
            : dropFightRules();
      commands.push({ type: "setRules", creepId: victim.id, rules });
      continue;
    }
    for (const helper of choice.helpers) {
      const base = rulesFor(roleOf(helper, params), helper.dna, level);
      commands.push({
        type: "setRules",
        creepId: helper.id,
        rules: [helperRule(victim.id), ...base],
      });
      locked.add(helper.id);
      follows.get(helper.id)!.push(victim.id);
    }
  }
  return { commands, locked };
}

/**
 * The enemies the team sees (R spec D18): every creep of another team and
 * every wanderer, whatever the number of teams.
 */
/**
 * The enemies in sight that threaten the team (R F3's C1-1): every wanderer,
 * and each creep of another team chasing one of the team's creeps.
 */
function threatening(seen: TeamView): Cell[] {
  const own = new Set(ownCreeps(seen).map((c) => c.id));
  const chases = (c: (typeof seen.creeps)[number]) => {
    const target = c.hostile?.target;
    return target !== undefined && target !== null && own.has(target);
  };
  return [
    ...seen.creeps.filter((c) => c.team !== seen.team && chases(c)),
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

/**
 * A raid group member's or an escort's rules (R spec D16, D8): the stand,
 * following its leader (and joining its battles), the DNA's help rule, and
 * the materia collector's rules, which take over once the leader is gone.
 */
export function followerRules(leader: number, dna: Dna): Rule[] {
  return [
    ...standRules(),
    { when: { type: "always" }, then: { type: "follow", creepId: leader } },
    helpRule(dna),
    ...collectorRules("materia"),
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

/** After a drop to fight (D27): pick the spoils up, on top of the role. */
const pickupRule = (): Rule => ({
  when: { type: "always" },
  then: { type: "pickup" },
});

/**
 * The creep's rules without the ones the bot puts on top of a role's for a
 * while (the defense rule, a helper's follow, the pickup after a fight), so
 * roleOf reads the role underneath.
 */
function withoutWrappers(rules: readonly Rule[], params: Params): Rule[] {
  const defense = canonicalJson(defenseRule(params));
  const pickup = canonicalJson(pickupRule());
  const wraps = (rule: Rule) =>
    rule.when.type === "always" &&
    (rule.then.type === "follow" ||
      (rule.then.type === "approach" && canonicalJson(rule) === defense) ||
      (rule.then.type === "pickup" && canonicalJson(rule) === pickup));
  let at = 0;
  while (at < rules.length && wraps(rules[at]!)) at++;
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
  materia: string;
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
    materia: canonicalJson(collectorRules("materia")),
  };
  const actions = actionsOf(withoutWrappers(creep.rules, params));
  const [first, ...rest] = actions;
  if (
    first?.then.type === "follow" &&
    canonicalJson(rest) === presetJson.materia
  ) {
    return { kind: "follower", leader: first.then.creepId };
  }
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
    case "follower":
      return followerRules(role.leader, dna);
  }
}

/**
 * Moves creeps between roles to reach the balanced split. Creeps leaving a
 * role that has too many are taken lowest id first, and so are the materia
 * creeps that fill a role short of creeps: cristal, then the road builder,
 * then the raiders. The `locked` creeps (the threat pass's) keep their
 * role and rules.
 */
function assignRoles(known: Knowledge, locked: ReadonlySet<number>): Command[] {
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
  // (encontro F3 checkpoint, C1): it goes back to gathering. At normal and
  // hard the raider leads a group (D16).
  const groups = level !== "easy";
  const raiders = BALANCED.raiderShare;
  const { raidGroup, escort } = BALANCED;
  const wantRaiders = !canExplore
    ? 0
    : groups
      ? creeps.length >= raidGroup.minCreeps
        ? 1
        : 0
      : Math.floor((creeps.length * raiders.numerator) / raiders.denominator);
  const wantEscorts =
    groups && creeps.length >= escort.minCreeps ? escort.followers : 0;

  const roles = new Map(creeps.map((c) => [c, roleOf(c, params)]));
  const next = new Map(roles);
  const inRole = (kind: Role["kind"]) =>
    creeps.filter((c) => next.get(c)!.kind === kind);
  /** The members of a role the bot may move. */
  const movable = (kind: Role["kind"]) =>
    inRole(kind).filter((c) => !locked.has(c.id));
  const byId = new Map(creeps.map((c) => [c.id, c]));
  const followersOf = (leader: CreepView) =>
    creeps.filter((c) => {
      const role = next.get(c)!;
      return role.kind === "follower" && role.leader === leader.id;
    });
  /**
   * The materia creeps a group may take (D16): free, healthiest first by
   * their share of the DNA's HP, ties to the lower id.
   */
  const strongest = () =>
    movable("materia")
      .filter(
        (c) =>
          c.dominatedBy === null && c.engagement === null && c.battle === null,
      )
      .sort(
        (a, b) =>
          b.hp * params.hp.dna[a.dna].max - a.hp * params.hp.dna[b.dna].max ||
          a.id - b.id,
      );

  const trim = (kind: Role["kind"], want: number) => {
    const excess = inRole(kind).length - want;
    for (const creep of movable(kind).slice(0, Math.max(0, excess))) {
      next.set(creep, { kind: "materia" });
    }
  };
  const fill = (role: Role, want: number) => {
    const missing = want - inRole(role.kind).length;
    for (const creep of movable("materia").slice(0, Math.max(0, missing))) {
      next.set(creep, role);
    }
  };
  trim("builder", wantBuilders);
  trim("cristal", wantCristal);
  trim("raider", wantRaiders);
  // A follower whose leader is gone or left its role gathers (D16).
  for (const creep of movable("follower")) {
    const role = next.get(creep) as Extract<Role, { kind: "follower" }>;
    const leader = byId.get(role.leader);
    const kind = leader === undefined ? null : next.get(leader)!.kind;
    if (kind !== "raider" && kind !== "cristal") {
      next.set(creep, { kind: "materia" });
    }
  }
  fill({ kind: "cristal" }, wantCristal);
  fill({ kind: "builder" }, wantBuilders);
  if (groups) {
    const missing = wantRaiders - inRole("raider").length;
    for (const creep of strongest().slice(0, Math.max(0, missing))) {
      next.set(creep, { kind: "raider" });
    }
  } else {
    fill({ kind: "raider" }, wantRaiders);
  }
  /** Keeps `want` followers on `leader`: the lowest ids leave first. */
  const follow = (leader: CreepView, want: number) => {
    const members = followersOf(leader);
    const excess = members.length - want;
    for (const creep of members
      .filter((c) => !locked.has(c.id))
      .slice(0, Math.max(0, excess))) {
      next.set(creep, { kind: "materia" });
    }
    const missing = want - followersOf(leader).length;
    for (const creep of strongest().slice(0, Math.max(0, missing))) {
      next.set(creep, { kind: "follower", leader: leader.id });
    }
  };
  if (groups) {
    for (const raider of inRole("raider")) follow(raider, raidGroup.followers);
    // The escort stays with its collector; a new one takes the lowest id.
    const collectors = inRole("cristal");
    const escorted = collectors.filter((c) => followersOf(c).length > 0);
    const leader = escorted[0] ?? collectors[0];
    for (const other of collectors) if (other !== leader) follow(other, 0);
    if (leader !== undefined) follow(leader, wantEscorts);
  }

  // Defense (D14, normal and hard): while an enemy that threatens the team
  // stands in the core zone (C1-1), the creeps inside it attack on top of
  // their role.
  const inZone = (cell: Cell) =>
    manhattan(cell, team.core) <= params.hp.coreZoneRadius;
  const defending = level !== "easy" && threatening(seen).some(inZone);

  // A raider gets its preset; a gatherer, its role's preset behind its
  // posture (setRules), also when only the posture is missing (a newborn).
  const commands: Command[] = [];
  const pickup = canonicalJson(pickupRule());
  for (const creep of creeps) {
    if (locked.has(creep.id)) continue;
    const role = next.get(creep)!;
    const own = rulesFor(role, creep.dna, level);
    // After dropping to fight (D27), it picks the spoils up while the team
    // remembers some.
    const wrappers = creep.rules.slice(
      0,
      creep.rules.length - withoutWrappers(creep.rules, params).length,
    );
    const picking =
      seen.spoils.length > 0 &&
      (responseOf(creep.rules) === "dropFight" ||
        wrappers.some((r) => canonicalJson(r) === pickup));
    const base = picking ? [pickupRule(), ...own] : own;
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
