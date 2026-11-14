// Bot strategists (plan section 9; balanced decided by the owner in F5,
// 2026-11-13). A strategist is a team policy that issues the same external
// commands a human would (produce, buyUpgrade, applyPreset). It decides from
// the state alone, with no memory of its own, so a run restored from a
// snapshot or replayed from the log takes the same decisions. Harness only:
// in the game, teams without humans run on autopilot (plan P5). The same
// determinism lint as the sim applies to this file.

import {
  canAfford,
  canonicalJson,
  collectorRules,
  DNAS,
  manhattan,
  nextSegment,
  productionRefusal,
  roadBuilderRules,
  type Cell,
  type Command,
  type Creep,
  type Dna,
  type Team,
  type WorldState,
} from "@geometrix/sim";

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

export function strategistCommands(
  id: StrategistId,
  state: WorldState,
  team: number,
): Command[] {
  switch (id) {
    case "balanced":
      return balanced(state, state.teams[team]!);
    case "none":
      return [];
  }
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

function balanced(state: WorldState, team: Team): Command[] {
  const commands: Command[] = [];
  const { params } = state;
  const stock = { ...team.stock };

  if (productionRefusal(state, team) === null) {
    commands.push({
      type: "produce",
      dna: scarcestDna(state, team),
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
  commands.push(...assignRoles(state, team));
  return commands;
}

/** The DNA the team has fewest creeps of; ties in DNAS order (■ ▲ ●). */
function scarcestDna(state: WorldState, team: Team): Dna {
  const counts = DNAS.map(
    (dna) =>
      state.creeps.filter((c) => c.team === team.id && c.dna === dna).length,
  );
  return DNAS[counts.indexOf(Math.min(...counts))]!;
}

/** The role a creep's rules match; anything else counts as materia. */
function roleOf(creep: Creep): Role {
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
export function roadTarget(state: WorldState, team: Team): Cell | null {
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
function assignRoles(state: WorldState, team: Team): Command[] {
  const creeps = state.creeps.filter((c) => c.team === team.id);
  const hasCristal = state.deposits.some(
    (d) => d.kind === "cristal" && d.amount > 0,
  );
  const { numerator, denominator } = BALANCED.cristalShare;
  const wantCristal = hasCristal
    ? Math.floor((creeps.length * numerator + denominator - 1) / denominator)
    : 0;
  const target = roadTarget(state, team);
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
