// The wanderers (junction spec D14, W-1, W-2, W-6; plan section 9, P4,
// P11): hostile circles of no team. Not a player nor a strategist: a stage
// of their own. Stage 2 decides each one's order (join a battle in sight,
// attack a loaded creep in sight, or roam the band), stage 3 moves them, the
// encounters stage opens their attacks (encounter.ts) and joins (battle.ts),
// stage 5 gives birth by the curve. They see with the circle's sight on the
// real map, which they know whole, and never step into a core zone. Always
// in id order, so the calls to state.rng come in a fixed order.

import { inCoreZone } from "./hp.ts";
import {
  battleToJoin,
  findBattle,
  findFighter,
  fighterMaxHp,
  isStandable,
} from "./battle.ts";
import { cargoTotal } from "./economy.ts";
import { creepRef, emit, type EventLog } from "./events.ts";
import { manhattan, Terrain, type Cell, type GameMap } from "./map.ts";
import { CELL_COST, movePointsPerTick } from "./movement.ts";
import { halt } from "./orders.ts";
import { findPath } from "./pathfinding.ts";
import { nextInt } from "./rng.ts";
import { sightCells } from "./vision.ts";
import { nameAt } from "./names.ts";
import {
  sideTeam,
  type Battle,
  type Creep,
  type Wanderer,
  type WorldState,
} from "./world.ts";

/** Whether `cell` is in any team's core zone: the wanderers never enter one. */
function inAnyCoreZone(state: WorldState, cell: Cell): boolean {
  return state.teams.some((team) => inCoreZone(state, team.id, cell));
}

/**
 * The band (D14): the cells a creep can stand on, in the rows within
 * `wanderers.bandRows` of a river row, outside every core zone. In index
 * order.
 */
export function bandCells(state: WorldState): Cell[] {
  const { map } = state;
  const riverRows: number[] = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (map.terrain[y * map.width + x] === Terrain.river) {
        riverRows.push(y);
        break;
      }
    }
  }
  const { bandRows } = state.params.wanderers;
  const cells: Cell[] = [];
  for (let y = 0; y < map.height; y++) {
    if (!riverRows.some((r) => Math.abs(r - y) <= bandRows)) continue;
    for (let x = 0; x < map.width; x++) {
      const cell = { x, y };
      if (isStandable(state, cell) && !inAnyCoreZone(state, cell)) {
        cells.push(cell);
      }
    }
  }
  return cells;
}

/**
 * The interval to the next birth, in ticks, at `tick` (D14): from
 * `intervalSeconds.start` down to `end`, linearly over the world's duration.
 */
export function birthInterval(state: WorldState, tick: number): number {
  const { tickSeconds, durationSeconds } = state.params.world;
  const { start, end } = state.params.wanderers.intervalSeconds;
  const elapsed = Math.min(tick * tickSeconds, durationSeconds);
  const seconds =
    start - Math.floor(((start - end) * elapsed) / durationSeconds);
  return Math.max(1, Math.floor(seconds / tickSeconds));
}

/**
 * Stage 5 (W-1): when the time has come and fewer than the cap are alive,
 * a wanderer is born on a free cell of the band drawn by state.rng; the
 * next one may come one interval later.
 */
export function runWandererBirths(state: WorldState, log: EventLog): void {
  const { cap, hp } = state.params.wanderers;
  if (state.tick < state.nextWandererTick) return;
  if (state.wanderers.length >= cap) return;
  const taken = (cell: Cell) =>
    state.creeps.some((c) => c.x === cell.x && c.y === cell.y) ||
    state.wanderers.some((w) => w.x === cell.x && w.y === cell.y);
  const cells = bandCells(state).filter((cell) => !taken(cell));
  if (cells.length === 0) return;
  const cell = cells[nextInt(state.rng, cells.length)]!;
  const wanderer: Wanderer = {
    id: state.nextId++,
    dna: "circle",
    name: nameAt(state.births++),
    hp: hp * 1000,
    cargo: { materia: 0, cristal: 0 },
    battle: null,
    order: { type: "stop" },
    movePoints: 0,
    path: null,
    spared: [],
    ...cell,
  };
  state.wanderers.push(wanderer);
  state.nextWandererTick = state.tick + birthInterval(state, state.tick);
  emit(log, { type: "wandererBorn", wanderer: creepRef(wanderer), ...cell });
}

/** The cells a wanderer sees (the circle's sight, D14), increasing. */
function sightOf(state: WorldState, wanderer: Wanderer): readonly number[] {
  const radius = state.params.vision.dna.circle;
  return sightCells(state.map, wanderer, radius, false);
}

function sees(state: WorldState, sight: readonly number[], cell: Cell) {
  const target = cell.y * state.map.width + cell.x;
  let lo = 0;
  let hi = sight.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const value = sight[mid]!;
    if (value === target) return true;
    if (value < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return false;
}

/** The nearest of `creeps` (Manhattan, then id), or null. */
function nearest(from: Cell, creeps: readonly Creep[]): Creep | null {
  let best: Creep | null = null;
  for (const creep of creeps) {
    if (
      best === null ||
      manhattan(from, creep) < manhattan(from, best) ||
      (manhattan(from, creep) === manhattan(from, best) && creep.id < best.id)
    ) {
      best = creep;
    }
  }
  return best;
}

/** Whether the wanderers' side has room in `battle` (D6: sideCap, maxSides). */
function roomFor(state: WorldState, battle: Battle): boolean {
  const side = battle.sides.findIndex((s) => s.kind === "wanderers");
  if (side < 0) return battle.sides.length < state.params.battle.maxSides;
  const members = battle.participants.filter((p) => p.side === side);
  return members.length < state.params.battle.sideCap;
}

/**
 * What the wanderer goes for (W-2, owner 2026-11-25): a team's creep in a
 * battle in sight whose wanderers' side has room, to join it; else a free,
 * loaded team creep in sight outside the core zones, to attack it; else
 * null.
 */
function targetOf(state: WorldState, wanderer: Wanderer): Creep | null {
  const sight = sightOf(state, wanderer);
  const radius = state.params.vision.dna.circle;
  const near = (creep: Creep) =>
    manhattan(wanderer, creep) <= radius &&
    sees(state, sight, creep) &&
    !wanderer.spared.some((s) => s.creep === creep.id);
  const joinable = state.creeps.filter((creep) => {
    if (creep.battle === null || !near(creep)) return false;
    const battle = findBattle(state, creep.battle)!;
    const side = battle.participants.find((p) => p.id === creep.id)!.side;
    // A team's creep, not one of the wanderers' own side.
    return sideTeam(battle.sides[side]!) !== null && roomFor(state, battle);
  });
  const join = nearest(wanderer, joinable);
  if (join !== null) return join;
  return nearest(
    wanderer,
    state.creeps.filter(
      (creep) =>
        creep.battle === null &&
        cargoTotal(creep) > 0 &&
        !inAnyCoreZone(state, creep) &&
        near(creep),
    ),
  );
}

/**
 * Stage 2 (W-2): each free wanderer, by id, approaches its target, or keeps
 * roaming toward its band cell, or draws a new one.
 */
export function decideWanderers(state: WorldState): void {
  if (state.wanderers.length === 0) return;
  let band: Cell[] | null = null;
  for (const wanderer of state.wanderers) {
    if (wanderer.spared.some((s) => s.untilTick <= state.tick)) {
      wanderer.spared = wanderer.spared.filter((s) => s.untilTick > state.tick);
    }
    if (wanderer.battle !== null) continue;
    const target = targetOf(state, wanderer);
    if (target !== null) {
      if (
        wanderer.order.type !== "approach" ||
        wanderer.order.targetId !== target.id
      ) {
        halt(wanderer);
        wanderer.order = { type: "approach", targetId: target.id };
      }
      continue;
    }
    if (wanderer.order.type === "roam") continue;
    band ??= bandCells(state);
    if (band.length === 0) {
      halt(wanderer);
      continue;
    }
    const cell = band[nextInt(state.rng, band.length)]!;
    halt(wanderer);
    wanderer.order = { type: "roam", ...cell };
  }
}

/**
 * The real map with every core zone's cells as rock: the wanderers' routes
 * go around the zones instead of stopping at their edge. Derived from the
 * map and the cores, which a world never changes; a restore rebuilds it.
 */
const zonedMaps = new WeakMap<GameMap, GameMap>();

function wandererMap(state: WorldState): GameMap {
  const cached = zonedMaps.get(state.map);
  if (cached !== undefined) return cached;
  const { map } = state;
  const terrain = map.terrain.map((t, i) =>
    inAnyCoreZone(state, { x: i % map.width, y: Math.floor(i / map.width) })
      ? Terrain.rock
      : t,
  );
  const zoned: GameMap = { ...map, terrain };
  zonedMaps.set(state.map, zoned);
  return zoned;
}

/**
 * The wanderer's path to `target` on the real map around the core zones,
 * from its cache while the target is the same cell.
 */
function wandererPath(
  state: WorldState,
  wanderer: Wanderer,
  target: Cell,
): number[] | null {
  const index = target.y * state.map.width + target.x;
  if (wanderer.path !== null && wanderer.path.target === index) {
    return wanderer.path.cells;
  }
  const cells = findPath(wandererMap(state), wanderer, target, state.params);
  wanderer.path =
    cells === null
      ? null
      : { target: index, roadRevision: 0, blockRevision: 0, cells };
  return cells;
}

type Walk = "arrived" | "moving" | "stuck";

/**
 * A step of the creeps' movement (orders.ts walk) on the real map at the
 * circle's speed. It never enters a core zone (owner, 2026-11-25): its
 * route goes around them, and a target it cannot reach without entering
 * one is "stuck".
 */
function walkWanderer(
  state: WorldState,
  wanderer: Wanderer,
  target: Cell,
): Walk {
  const path = wandererPath(state, wanderer, target);
  if (path === null) return "stuck";
  if (path.length > 0) {
    const { map, params } = state;
    wanderer.movePoints += movePointsPerTick(wanderer, map, path[0]!, params);
    while (path.length > 0 && wanderer.movePoints >= CELL_COST) {
      const next = path[0]!;
      const cell = { x: next % map.width, y: Math.floor(next / map.width) };
      if (inAnyCoreZone(state, cell)) return "stuck";
      path.shift();
      wanderer.x = cell.x;
      wanderer.y = cell.y;
      wanderer.movePoints -= CELL_COST;
    }
    if (path.length > 0) return "moving";
  }
  wanderer.movePoints = 0;
  wanderer.path = null;
  return "arrived";
}

/**
 * Stage 3: the wanderers walk. An approach goes to its target's cell, and
 * waits at the bubble of the target's battle to join it (J-3); a roam goes
 * to its cell and stops there, so the next tick draws another.
 */
export function moveWanderers(state: WorldState): void {
  for (const wanderer of state.wanderers) {
    if (wanderer.battle !== null) continue;
    const { order } = wanderer;
    if (order.type === "stop") continue;
    if (order.type === "roam") {
      if (walkWanderer(state, wanderer, order) !== "moving") halt(wanderer);
      continue;
    }
    const target = findFighter(state, order.targetId);
    if (target === undefined) {
      halt(wanderer);
      continue;
    }
    if (battleToJoin(state, wanderer) !== undefined) {
      wanderer.movePoints = 0;
      wanderer.path = null;
      continue;
    }
    if (walkWanderer(state, wanderer, target) === "stuck") halt(wanderer);
  }
}

/**
 * Stage 6 (W-6, owner 2026-11-25): on each world minute a wanderer outside
 * a battle heals like a creep on the map, up to its max.
 */
export function regenerateWanderers(state: WorldState): void {
  const { params } = state;
  const elapsed = (state.tick + 1) * params.world.tickSeconds;
  if (elapsed % 60 !== 0) return;
  const permille = params.hp.regenPermillePerMinute.map;
  for (const wanderer of state.wanderers) {
    if (wanderer.battle !== null) continue;
    const max = fighterMaxHp(state, wanderer);
    wanderer.hp = Math.min(wanderer.hp + max * permille, max * 1000);
  }
}
