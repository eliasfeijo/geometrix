// What a buildRoad to a cell would build and cost (F9, road mode feedback).
// It follows the sim (roads.ts): the cheapest path from the team's core to
// the cell; each cell of it without a road is a segment, paid when it starts
// unless a job already paid for it; the road stops at the first cell that
// cannot take one (a crossing, a rock, a core).

import { RESOURCE_NAMES } from "../format.ts";
import {
  canAfford,
  findPath,
  isRotatedSide,
  Terrain,
  type Cell,
  type Cost,
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
  let blockedAt: number | null = null;
  for (const i of path) {
    if (road[i] === 1) continue;
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
