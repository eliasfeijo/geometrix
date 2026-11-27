// What a buildRoad to a cell would build and cost (F9, road mode feedback).
// It follows the sim (roads.ts): the cheapest path from the team's core to
// the cell; each cell of it without a road is a segment, paid when it starts
// unless a job already paid for it; the road stops at the first cell that
// cannot take one (a crossing, a rock, a core).

import { RESOURCE_NAMES } from "../format.ts";
import {
  canAfford,
  canBuildRoad,
  findPath,
  isOwnTeam,
  isRotatedSide,
  roadTarget,
  Terrain,
  type Cell,
  type Cost,
  type CreepView,
  type Params,
  type TeamView,
} from "@geometrix/sim";

export type RoadPlan =
  /** No path from the core to the cell. */
  | { kind: "unreachable" }
  | {
      kind: "plan";
      /** Cells to pay for, in building order. */
      paid: number[];
      /** Cells that already have a road. */
      built: number[];
      /** Cells with a job already paid: no new payment. */
      free: number[];
      /** The cell where the road stops before the target, or null. */
      blockedAt: number | null;
      cost: Cost;
    };

export function roadPlan(
  map: { width: number; height: number; terrain: readonly number[] },
  state: Pick<TeamView, "roads" | "roadJobs" | "teams">,
  params: Params,
  team: number,
  target: Cell,
): RoadPlan {
  const core = state.teams[team]?.core;
  if (core === undefined || core === null) return { kind: "unreachable" };
  const road = new Array<number>(map.width * map.height).fill(0);
  for (const i of state.roads) road[i] = 1;
  const path = findPath(
    {
      width: map.width,
      height: map.height,
      terrain: [...map.terrain] as Terrain[],
      road,
    },
    core,
    target,
    params,
    isRotatedSide(team),
  );
  if (path === null) return { kind: "unreachable" };
  const cores = new Set(
    state.teams.flatMap((t) =>
      t.core === null ? [] : [t.core.y * map.width + t.core.x],
    ),
  );
  const jobs = new Set(state.roadJobs.map((j) => j.y * map.width + j.x));
  const paid: number[] = [];
  const free: number[] = [];
  const built: number[] = [];
  let blockedAt: number | null = null;
  for (const i of path) {
    if (road[i] === 1) {
      built.push(i);
      continue;
    }
    if (map.terrain[i] !== Terrain.jungle || cores.has(i)) {
      blockedAt = i;
      break;
    }
    (jobs.has(i) ? free : paid).push(i);
  }
  const { materia, cristal } = params.road.cost;
  return {
    kind: "plan",
    paid,
    built,
    free,
    blockedAt,
    cost: { materia: materia * paid.length, cristal: cristal * paid.length },
  };
}

/**
 * The text over the cell and whether the stock is short for it. Over a cell
 * the team never saw there is no cost (fog spec C-3): the dark counts as
 * jungle, and what is really there shows only as the road gets near.
 */
export function roadPlanLabel(
  plan: RoadPlan,
  stock: { materia: number; cristal: number } | undefined,
  seen = true,
): [string, boolean] {
  if (!seen) return ["nunca vista · custo desconhecido", false];
  if (plan.kind === "unreachable") return ["sem caminho", false];
  const cells = plan.paid.length + plan.free.length;
  if (cells === 0) {
    return [
      plan.blockedAt === null ? "já tem estrada" : "sem estrada aqui",
      false,
    ];
  }
  const short = stock !== undefined && !canAfford(stock, plan.cost);
  const cellText = cells === 1 ? "1 célula" : `${cells} células`;
  return [`${cellText} · ${costText(plan.cost)}`, short];
}

function costText(cost: Cost): string {
  const parts = (["materia", "cristal"] as const)
    .filter((r) => cost[r] > 0)
    .map((r) => `${cost[r]} ${RESOURCE_NAMES[r]}`);
  return parts.length === 0 ? "já paga" : parts.join(" + ");
}

/**
 * Road mode under the pointer: the plan for `cell`, its text and whether the
 * stock is short, for the preview and the cursor (fog F6, E4).
 */
export function roadPreview(
  map: { width: number; height: number; terrain: readonly number[] },
  state: TeamView,
  params: Params,
  team: number,
  cell: Cell,
): { plan: RoadPlan; text: string; short: boolean } {
  const plan = roadPlan(map, state, params, team, cell);
  const own = state.teams[team];
  const stock = own !== undefined && isOwnTeam(own) ? own.stock : undefined;
  const seen = state.known[cell.y * map.width + cell.x] !== -1;
  const [text, short] = roadPlanLabel(plan, stock, seen);
  return { plan, text, short };
}

/** What a road builder on autopilot is building toward (R spec D13, RB-3). */
export type BuilderPlan =
  /** No known deposit left without a road and with a segment to build. */
  | { kind: "none" }
  | {
      kind: "target";
      target: Cell;
      plan: Extract<RoadPlan, { kind: "plan" }>;
      /** The whole road's cost, and what is already paid of it. */
      total: Cost;
      done: Cost;
    };

/**
 * The plan of a creep whose rules build road with no cell, on what its team
 * knows, resolved as the autopilot does (sim autoRoadTarget); null for any
 * other creep, and for a dominated one, whose player chooses (D12).
 */
export function builderPlan(
  map: { width: number; height: number; terrain: readonly number[] },
  state: TeamView,
  params: Params,
  creep: CreepView,
): BuilderPlan | null {
  const builds = creep.rules.some(
    (r) => r.then.type === "buildRoad" && r.then.x === undefined,
  );
  const team = state.teams[creep.team];
  if (!builds || creep.dominatedBy !== null || team === undefined) return null;
  const { core } = team;
  if (core === null) return null;
  const road = new Array<number>(map.width * map.height).fill(0);
  for (const i of state.roads) road[i] = 1;
  const context = {
    map: {
      width: map.width,
      height: map.height,
      terrain: [...map.terrain] as Terrain[],
      road,
    },
    params,
    teams: state.teams.flatMap((t) =>
      t.core === null ? [] : [{ core: t.core }],
    ),
    deposits: state.deposits,
  };
  const { order } = creep;
  const keep =
    order.type === "buildRoad" &&
    order.segment >= 0 &&
    canBuildRoad(context, order.segment)
      ? { x: order.x, y: order.y }
      : null;
  const target = roadTarget(context, { id: creep.team, core }, keep);
  if (target === null) return { kind: "none" };
  const plan = roadPlan(map, state, params, creep.team, target);
  if (plan.kind !== "plan") return { kind: "none" };
  const times = (cells: number): Cost => ({
    materia: params.road.cost.materia * cells,
    cristal: params.road.cost.cristal * cells,
  });
  const done = plan.built.length + plan.free.length;
  return {
    kind: "target",
    target,
    plan,
    total: times(done + plan.paid.length),
    done: times(done),
  };
}

/** "Estrada até a jazida: 450 de 1.200 matéria pagos" (D13). */
export function builderText(builder: BuilderPlan): string {
  if (builder.kind === "none") return "nenhuma jazida conhecida sem estrada";
  const { total, done } = builder;
  const parts = (["materia", "cristal"] as const)
    .filter((r) => total[r] > 0)
    .map(
      (r) =>
        `${done[r].toLocaleString("pt-BR")} de ` +
        `${total[r].toLocaleString("pt-BR")} ${RESOURCE_NAMES[r]}`,
    );
  return `Estrada até a jazida: ${parts.join(" e ")} pagos`;
}
