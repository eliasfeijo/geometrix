// Creeps (spec C-1): shape = DNA, fill = team, a ring with the cargo (materia
// then cristal, as a share of the capacity), a halo while someone dominates
// it, and an hourglass while it waits at a drained deposit.

import { capacity, type Params, type Team } from "@geometrix/sim";
import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { useGame } from "../context.ts";
import { creepStatus, type Creep } from "../creep-status.ts";
import { COLORS, teamColor } from "./colors.ts";
import { DnaShape } from "./creep-shape.tsx";
import { creepPositions, crowdOffsets, glideProgress } from "./interpolate.ts";
import { arcDash } from "./shapes.ts";
import { markerScale, type Point } from "./view.ts";

const SHAPE_RADIUS = 0.3;
const CARGO_RADIUS = 0.43;
/** Shapes shrink when several creeps share a cell. */
const CROWD_SCALE = 0.7;

/** Drawn center of each creep (cells), after gliding and crowd spreading. */
export function drawnCenters(
  creeps: Creep[],
  positions: Map<number, Point>,
  zoomScale = 1,
): Map<number, Point & { scale: number }> {
  const byCell = new Map<string, Creep[]>();
  for (const creep of creeps) {
    const key = `${creep.x},${creep.y}`;
    const list = byCell.get(key);
    if (list === undefined) byCell.set(key, [creep]);
    else list.push(creep);
  }
  const centers = new Map<number, Point & { scale: number }>();
  for (const group of byCell.values()) {
    const offsets = crowdOffsets(group.length);
    const scale = (group.length > 1 ? CROWD_SCALE : 1) * zoomScale;
    group.forEach((creep, i) => {
      const p = positions.get(creep.id) ?? creep;
      centers.set(creep.id, {
        x: p.x + 0.5 + offsets[i]!.x * zoomScale,
        y: p.y + 0.5 + offsets[i]!.y * zoomScale,
        scale,
      });
    });
  }
  return centers;
}

/**
 * Re-renders on each animation frame while a glide is under way, and stays
 * still once the creeps reach the current state.
 */
function useGlide(): number {
  const { store } = useGame();
  const t = useSignal(1);
  useEffect(() => {
    let frame = 0;
    const loop = () => {
      const current = store.current.value;
      if (current !== null) {
        const next = glideProgress(
          store.previous.value,
          current,
          performance.now(),
        );
        if (next !== t.value) t.value = next;
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);
  return t.value;
}

export function CreepLayer() {
  const { store, session } = useGame();
  const t = useGlide();
  const current = store.current.value;
  const info = store.info.value;
  if (current === null || info === null) return null;
  const { state } = current;
  const positions = creepPositions(
    store.previous.value?.state ?? null,
    state,
    t,
  );
  const zoom = markerScale(store.view.value?.scale ?? 1);
  const centers = drawnCenters(state.creeps, positions, zoom);
  return (
    <g class="creep-layer">
      {state.creeps.map((creep) => (
        <CreepMark
          key={creep.id}
          creep={creep}
          center={centers.get(creep.id)!}
          team={state.teams[creep.team]!}
          params={info.params}
          mine={creep.dominatedBy === session.playerId}
          waiting={creepStatus(creep, state.deposits) === "waiting"}
        />
      ))}
    </g>
  );
}

type MarkProps = {
  creep: Creep;
  center: Point & { scale: number };
  team: Team;
  params: Params;
  /** Dominated by this player. */
  mine: boolean;
  waiting: boolean;
};

function CreepMark({ creep, center, team, params, mine, waiting }: MarkProps) {
  const { x: cx, y: cy, scale } = center;
  const color = teamColor(creep.team);
  const max = capacity({ ...creep, path: null }, team, params);
  const materia = creep.cargo.materia / max;
  const cristal = creep.cargo.cristal / max;
  const ring = CARGO_RADIUS * scale;
  const circumference = 2 * Math.PI * ring;
  const rotate = `rotate(-90 ${cx} ${cy})`;
  return (
    <g class="creep">
      {creep.dominatedBy !== null && (
        <circle
          class={mine ? "halo halo-mine" : "halo"}
          cx={cx}
          cy={cy}
          r={ring + 0.14 * scale}
          fill="none"
          stroke={COLORS.dominated}
          stroke-width={(mine ? 0.09 : 0.05) * scale}
          stroke-dasharray={mine ? undefined : "0.12 0.08"}
        />
      )}
      <circle
        cx={cx}
        cy={cy}
        r={ring}
        fill="none"
        stroke={COLORS.background}
        stroke-opacity="0.7"
        stroke-width={0.1 * scale}
      />
      {materia > 0 && (
        <circle
          cx={cx}
          cy={cy}
          r={ring}
          fill="none"
          stroke={COLORS.materia}
          stroke-width={0.1 * scale}
          stroke-dasharray={arcDash(ring, materia)}
          transform={rotate}
        />
      )}
      {cristal > 0 && (
        <circle
          cx={cx}
          cy={cy}
          r={ring}
          fill="none"
          stroke={COLORS.cristal}
          stroke-width={0.1 * scale}
          stroke-dasharray={arcDash(ring, cristal)}
          stroke-dashoffset={-circumference * materia}
          transform={rotate}
        />
      )}
      <DnaShape
        dna={creep.dna}
        cx={cx}
        cy={cy}
        r={SHAPE_RADIUS * scale}
        fill={color}
        stroke={COLORS.background}
        strokeWidth={0.05 * scale}
      />
      {waiting && (
        <Hourglass x={cx + ring * 0.75} y={cy - ring * 0.75} size={scale} />
      )}
    </g>
  );
}

/** Two small triangles: "waiting". */
function Hourglass({ x, y, size }: Point & { size: number }) {
  const s = 0.11 * Math.max(size, 1);
  return (
    <g class="hourglass">
      <circle cx={x} cy={y} r={s * 1.6} fill={COLORS.background} />
      <polygon
        points={`${x - s},${y - s} ${x + s},${y - s} ${x},${y} ${x + s},${y + s} ${x - s},${y + s} ${x},${y}`}
        fill={COLORS.outline}
      />
    </g>
  );
}
