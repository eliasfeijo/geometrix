// Where a creep of the team is heading (R spec D19, U-1) and when it gets
// there (D20, U-2, plan P14), from the sim's own path and speed rules on the
// map the team knows. An estimate: others change the world meanwhile.

import {
  capacity,
  cargoTotal,
  CELL_COST,
  findPath,
  isOwnTeam,
  isRotatedSide,
  movePointsPerTick,
  stepCost,
  type Cell,
  type CreepView,
  type GameMap,
  type Params,
  type TeamView,
  type Terrain,
} from "@geometrix/sim";

type KnownMap = {
  width: number;
  height: number;
  terrain: readonly number[];
};

/** The map as the team knows it, with its roads: the sim's knownMap. */
export function viewMap(map: KnownMap, roads: readonly number[]): GameMap {
  const road = new Array<number>(map.width * map.height).fill(0);
  for (const i of roads) road[i] = 1;
  return {
    width: map.width,
    height: map.height,
    terrain: [...map.terrain] as Terrain[],
    road,
  };
}

export type Route = {
  /** The order's destination (D19): where the marker stands. */
  cell: Cell;
  /** The cells still to walk, in order; empty when there already. */
  path: number[];
};

/**
 * The route of the creep's order, or null when it goes nowhere (stop, drop,
 * in a battle, a target the view lost). A follow stops within
 * `autopilot.followCells`; a creep joining a battle stops at its window.
 */
export function routeOf(
  creep: CreepView,
  state: TeamView,
  params: Params,
  map: GameMap,
): Route | null {
  if (creep.battle !== null) return null;
  const core = state.teams[creep.team]?.core ?? null;
  const rotated = isRotatedSide(creep.team);
  const to = (cell: Cell): Route => ({
    cell: { x: cell.x, y: cell.y },
    path: findPath(map, creep, cell, params, rotated) ?? [],
  });
  const { order } = creep;
  switch (order.type) {
    case "stop":
    case "drop":
      return null;
    case "moveTo":
    case "explore":
      return to(order);
    case "buildRoad":
      return order.segment < 0
        ? to(order)
        : to({
            x: order.segment % map.width,
            y: Math.floor(order.segment / map.width),
          });
    case "gather": {
      const deposit = state.deposits.find((d) => d.id === order.depositId);
      return deposit === undefined ? null : to(deposit);
    }
    case "deliver":
    case "flee":
      return core === null ? null : to(core);
    case "pickup": {
      const spoil = state.spoils.find((s) => s.id === order.spoilId);
      return spoil === undefined ? null : to(spoil);
    }
    case "approach":
    case "follow": {
      const target =
        state.creeps.find((c) => c.id === order.targetId) ??
        state.wanderers.find((w) => w.id === order.targetId);
      if (target === undefined) return null;
      const battle = state.battles.find((b) => b.id === target.battle);
      if (battle !== undefined) {
        const joining = to(battle);
        // Loaded, a follower delivers first when the core is cheaper (H-4).
        if (order.type === "follow" && cargoTotal(creep) > 0 && core !== null) {
          const home = to(core);
          if (costOf(map, home, params) < costOf(map, joining, params)) {
            return home;
          }
        }
        const { x, y, width, height } = battle.window;
        const inside = (i: number) => {
          const cx = i % map.width;
          const cy = Math.floor(i / map.width);
          return cx >= x && cx < x + width && cy >= y && cy < y + height;
        };
        if (inside(creep.y * map.width + creep.x)) {
          return { cell: joining.cell, path: [] };
        }
        const entry = joining.path.findIndex(inside);
        return entry < 0
          ? joining
          : { cell: joining.cell, path: joining.path.slice(0, entry + 1) };
      }
      const route = to(target);
      if (order.type === "approach") return route;
      const away = Math.abs(creep.x - target.x) + Math.abs(creep.y - target.y);
      const near = params.autopilot.followCells;
      return {
        cell: route.cell,
        path: away <= near ? [] : route.path.slice(0, -near),
      };
    }
  }
}

const costOf = (map: GameMap, route: Route, params: Params) =>
  route.path.reduce((sum, i) => sum + stepCost(map, i, params), 0);

/** What the creep's current action ends with, in real seconds at ×N. */
export type Eta = { kind: "arrive" | "fill" | "segment"; seconds: number };

/**
 * The estimate of D20: while walking, the time to arrive; while gathering,
 * the time to fill up; while building, the segment's remaining time. Null
 * when the creep does none of these.
 */
export function etaOf(
  creep: CreepView,
  state: TeamView,
  params: Params,
  map: GameMap,
  multiplier: number,
): Eta | null {
  if (creep.battle !== null || creep.engagement !== null) return null;
  const route = routeOf(creep, state, params, map);
  if (route === null) return null;
  const real = (worldSeconds: number, kind: Eta["kind"]): Eta => ({
    kind,
    seconds: Math.max(1, Math.round(worldSeconds / multiplier)),
  });
  const { order } = creep;
  const there = creep.x === route.cell.x && creep.y === route.cell.y;
  if (route.path.length > 0) {
    const bonus = order.type === "flee" ? params.flee.speedPermille : 1000;
    let ticks = 0;
    for (const i of route.path) {
      const gain = movePointsPerTick(creep, map, i, params);
      if (gain <= 0) return null;
      ticks += CELL_COST / Math.floor((gain * bonus) / 1000);
    }
    return real(Math.ceil(ticks) * params.world.tickSeconds, "arrive");
  }
  if (!there) return null;
  if (order.type === "gather") {
    const deposit = state.deposits.find((d) => d.id === order.depositId);
    // Waiting at a drained deposit has no estimate.
    if (deposit === undefined || deposit.amount === 0) return null;
    const team = state.teams[creep.team];
    if (team === undefined || !isOwnTeam(team)) return null;
    const free = capacity(creep, team, params) - cargoTotal(creep);
    if (free <= 0) return null;
    const pace = params.gather[deposit.kind];
    return real(Math.ceil(free / pace.units) * pace.everySeconds, "fill");
  }
  if (order.type === "buildRoad") {
    const job = state.roadJobs.find((j) => j.x === creep.x && j.y === creep.y);
    return job === undefined ? null : real(job.remainingSeconds, "segment");
  }
  return null;
}

const ETA_VERBS: Record<Eta["kind"], string> = {
  arrive: "chega",
  fill: "cheio",
  segment: "trecho",
};

/** "chega em ~40 s", "cheio em ~1 min 10 s". */
export function etaText({ kind, seconds }: Eta): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const time = m === 0 ? `${s} s` : s === 0 ? `${m} min` : `${m} min ${s} s`;
  return `${ETA_VERBS[kind]} em ~${time}`;
}
