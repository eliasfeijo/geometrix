// What changes with the state but is not a creep: roads, road jobs,
// deposits and the cores with their production.

import type { DynamicState } from "@geometrix/protocol";
import type { Deposit, Params, RoadJob, Team } from "@geometrix/sim";
import {
  arcDash,
  diamondPoints,
  hexagonPoints,
  octagonPoints,
} from "./shapes.ts";
import { COLORS, teamColor } from "./colors.ts";
import { roadRuns } from "./terrain.ts";
import { DnaShape } from "./creep-shape.tsx";

type Props = { state: DynamicState; params: Params; width: number };

export function WorldLayer({ state, params, width }: Props) {
  return (
    <g class="world-layer">
      <Roads roads={state.roads} width={width} />
      {state.roadJobs.map((job) => (
        <RoadJobMark key={job.id} job={job} params={params} />
      ))}
      {state.deposits.map((deposit) => (
        <DepositMark key={deposit.id} deposit={deposit} params={params} />
      ))}
      {state.teams.map((team) => (
        <CoreMark key={team.id} team={team} params={params} />
      ))}
    </g>
  );
}

function Roads({ roads, width }: { roads: number[]; width: number }) {
  return (
    <g shape-rendering="crispEdges">
      {roadRuns(roads, width).map((run) => (
        <rect
          key={`${run.x},${run.y}`}
          x={run.x + 0.08}
          y={run.y + 0.08}
          width={run.length - 0.16}
          height="0.84"
          fill={COLORS.road}
          stroke={COLORS.roadEdge}
          stroke-width="0.04"
        />
      ))}
    </g>
  );
}

function RoadJobMark({ job, params }: { job: RoadJob; params: Params }) {
  const done = 1 - job.remainingSeconds / params.road.buildSeconds;
  const color = teamColor(job.team);
  return (
    <g>
      <rect
        x={job.x + 0.08}
        y={job.y + 0.08 + 0.84 * (1 - done)}
        width="0.84"
        height={0.84 * done}
        fill={COLORS.road}
        opacity="0.8"
      />
      <rect
        x={job.x + 0.08}
        y={job.y + 0.08}
        width="0.84"
        height="0.84"
        fill="none"
        stroke={color}
        stroke-width="0.06"
        stroke-dasharray="0.15 0.1"
      />
    </g>
  );
}

const DEPOSIT_RADIUS = 0.42;

function DepositMark({
  deposit,
  params,
}: {
  deposit: Deposit;
  params: Params;
}) {
  const cx = deposit.x + 0.5;
  const cy = deposit.y + 0.5;
  const full = params.deposits[deposit.kind].amount;
  const ratio = Math.min(deposit.amount / full, 1);
  const shape = deposit.kind === "materia" ? hexagonPoints : diamondPoints;
  const empty = deposit.amount === 0;
  // Exhausted cristal never comes back (R-2): grey. Empty materia keeps its
  // color, dashed, while it regenerates.
  const color =
    empty && deposit.kind === "cristal"
      ? COLORS.depleted
      : COLORS[deposit.kind];
  return (
    <g class="deposit">
      <polygon
        points={shape(cx, cy, DEPOSIT_RADIUS)}
        fill={COLORS.background}
        fill-opacity="0.6"
        stroke={color}
        stroke-width="0.07"
        stroke-dasharray={empty ? "0.12 0.1" : undefined}
      />
      {ratio > 0 && (
        <polygon
          points={shape(cx, cy, DEPOSIT_RADIUS * Math.sqrt(ratio) * 0.85)}
          fill={color}
        />
      )}
    </g>
  );
}

const CORE_RADIUS = 0.95;

function CoreMark({ team, params }: { team: Team; params: Params }) {
  const cx = team.core.x + 0.5;
  const cy = team.core.y + 0.5;
  const color = teamColor(team.id);
  const production = team.production;
  const done =
    production === null
      ? 0
      : 1 - production.remainingSeconds / params.creep.productionSeconds;
  const ring = CORE_RADIUS + 0.25;
  return (
    <g class="core">
      <polygon
        points={octagonPoints(cx, cy, CORE_RADIUS)}
        fill={color}
        fill-opacity="0.18"
        stroke={color}
        stroke-width="0.12"
      />
      <polygon
        points={octagonPoints(cx, cy, CORE_RADIUS * 0.55)}
        fill="none"
        stroke={color}
        stroke-width="0.06"
      />
      {production !== null && (
        <>
          <circle
            cx={cx}
            cy={cy}
            r={ring}
            fill="none"
            stroke={color}
            stroke-opacity="0.25"
            stroke-width="0.12"
          />
          <circle
            cx={cx}
            cy={cy}
            r={ring}
            fill="none"
            stroke={color}
            stroke-width="0.12"
            stroke-dasharray={arcDash(ring, done)}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
          <DnaShape
            dna={production.dna}
            cx={cx}
            cy={cy}
            r={0.28}
            fill={color}
          />
        </>
      )}
      {team.repeat !== null && (
        <circle
          cx={cx}
          cy={cy}
          r={ring + 0.2}
          fill="none"
          stroke={color}
          stroke-width="0.05"
          stroke-dasharray="0.2 0.15"
        />
      )}
    </g>
  );
}
