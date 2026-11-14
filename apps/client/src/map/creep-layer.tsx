// Creeps (spec C-1): shape = DNA, fill = team, a ring with the cargo (materia
// then cristal, as a share of the capacity), a halo while someone dominates
// it, and an hourglass while it waits at a drained deposit. Creeps sharing a
// cell sit side by side, or form a stack when zoomed out (layout.ts).

import type { DynamicState } from "@geometrix/protocol";
import { capacity, type Cell, type Params, type Team } from "@geometrix/sim";
import { useSignal } from "@preact/signals";
import type { ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";
import { useGame } from "../context.ts";
import { creepStatus, type Creep } from "../creep-status.ts";
import type { GameStore } from "../store.ts";
import { COLORS, teamColor } from "./colors.ts";
import { DnaShape } from "./creep-shape.tsx";
import { creepPositions, glideProgress } from "./interpolate.ts";
import { layoutCreeps, markerOf, type Marker } from "./layout.ts";
import { arcDash } from "./shapes.ts";
import type { Point } from "./view.ts";

const SHAPE_RADIUS = 0.3;
const CARGO_RADIUS = 0.43;

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

/**
 * The creep a stack shows: the selected one, else the one this player
 * dominates, else the lowest id.
 */
export function stackLead(store: GameStore, ids: number[]): number {
  const selection = store.selection.value;
  if (selection?.kind === "creep" && ids.includes(selection.id)) {
    return selection.id;
  }
  const mine = store.myCreep.value;
  if (mine !== null && ids.includes(mine.id)) return mine.id;
  return ids[0]!;
}

/** Creep markers for glide progress `t`. */
export function markersFor(store: GameStore, t: number): Marker[] {
  const current = store.current.value;
  if (current === null) return [];
  const positions = creepPositions(
    store.previous.value?.state ?? null,
    current.state,
    t,
  );
  return layoutCreeps(
    current.state.creeps,
    positions,
    store.view.value?.scale ?? 1,
    (ids) => stackLead(store, ids),
  );
}

/** Creep markers right now, for picking with the pointer. */
export function markersNow(store: GameStore, now: number): Marker[] {
  const current = store.current.value;
  if (current === null) return [];
  return markersFor(store, glideProgress(store.previous.value, current, now));
}

export function CreepLayer() {
  const { store, session } = useGame();
  const t = useGlide();
  const current = store.current.value;
  const info = store.info.value;
  if (current === null || info === null) return null;
  const { state } = current;
  const markers = markersFor(store, t);
  const byId = new Map(state.creeps.map((c) => [c.id, c]));
  const selection = store.selection.value;
  const selected =
    selection?.kind === "creep" ? byId.get(selection.id) : undefined;
  const selectedMarker =
    selected === undefined ? undefined : markerOf(markers, selected.id);
  const hovered = store.hovered.value;
  const hoveredMarker =
    hovered === null ? undefined : markerOf(markers, hovered);
  const mark = (creep: Creep, center: Point & { scale: number }) => (
    <CreepMark
      creep={creep}
      center={center}
      team={state.teams[creep.team]!}
      params={info.params}
      mine={creep.dominatedBy === session.playerId}
      waiting={creepStatus(creep, state.deposits) === "waiting"}
    />
  );
  return (
    <g class="creep-layer">
      {selected !== undefined && selectedMarker !== undefined && (
        <OrderLine creep={selected} from={selectedMarker} state={state} />
      )}
      {markers.map((m) =>
        m.kind === "creep" ? (
          <g key={m.id}>{mark(byId.get(m.id)!, m)}</g>
        ) : (
          <StackMark
            key={`s${m.ids.join(",")}`}
            marker={m}
            lead={byId.get(m.lead)!}
          >
            {mark(byId.get(m.lead)!, m)}
          </StackMark>
        ),
      )}
      {hoveredMarker !== undefined && <HoverRing center={hoveredMarker} />}
      {selectedMarker !== undefined && (
        <SelectionRing center={selectedMarker} />
      )}
      {store.ping.value !== null && (
        <Ping key={store.ping.value.id} cell={store.ping.value.cell} />
      )}
      {selection !== null && selection.kind !== "creep" && (
        <CellSelection
          cell={
            selection.kind === "core"
              ? state.teams[selection.team]?.core
              : state.deposits.find((d) => d.id === selection.id)
          }
          size={selection.kind === "core" ? 2.6 : 1.1}
        />
      )}
    </g>
  );
}

/** Several creeps of a cell: copies behind the lead, and how many there are. */
function StackMark(props: {
  marker: Marker & { kind: "stack" };
  lead: Creep;
  children: ComponentChildren;
}) {
  const { x, y, scale, ids } = props.marker;
  const r = CARGO_RADIUS * scale;
  const color = teamColor(props.lead.team);
  const badge = 0.24 * scale;
  return (
    <g class="stack">
      {[2, 1].map((depth) => (
        <circle
          key={depth}
          cx={x + 0.09 * depth * scale}
          cy={y - 0.09 * depth * scale}
          r={r}
          fill={COLORS.background}
          stroke={color}
          stroke-opacity={0.5}
          stroke-width={0.05 * scale}
        />
      ))}
      {props.children}
      <circle
        cx={x + r}
        cy={y - r}
        r={badge}
        fill={COLORS.background}
        stroke={COLORS.outline}
        stroke-width={0.04 * scale}
      />
      <text
        x={x + r}
        y={y - r}
        fill={COLORS.outline}
        font-size={badge * 1.25}
        font-weight="700"
        text-anchor="middle"
        dominant-baseline="central"
      >
        {ids.length}
      </text>
    </g>
  );
}

function HoverRing({ center }: { center: Point & { scale: number } }) {
  return (
    <circle
      cx={center.x}
      cy={center.y}
      r={0.62 * center.scale}
      fill="none"
      stroke={COLORS.outline}
      stroke-width={0.06 * Math.max(center.scale, 0.5)}
    />
  );
}

/** A ring that shrinks and fades where an order was given. */
function Ping({ cell }: { cell: Cell }) {
  return (
    <circle
      class="ping"
      cx={cell.x + 0.5}
      cy={cell.y + 0.5}
      r="0.5"
      fill="none"
      stroke={COLORS.selection}
      stroke-width="0.1"
    />
  );
}

function SelectionRing({ center }: { center: Point & { scale: number } }) {
  return (
    <circle
      class="selection-ring"
      cx={center.x}
      cy={center.y}
      r={0.66 * center.scale}
      fill="none"
      stroke={COLORS.selection}
      stroke-width={0.07 * Math.max(center.scale, 0.5)}
      stroke-dasharray={`${0.25 * center.scale} ${0.12 * center.scale}`}
    />
  );
}

function CellSelection({ cell, size }: { cell?: Cell; size: number }) {
  if (cell === undefined) return null;
  return (
    <rect
      x={cell.x + 0.5 - size / 2}
      y={cell.y + 0.5 - size / 2}
      width={size}
      height={size}
      fill="none"
      stroke={COLORS.selection}
      stroke-width="0.08"
      stroke-dasharray="0.25 0.12"
    />
  );
}

/** The cell an order heads to, or null for stop. */
export function orderTarget(creep: Creep, state: DynamicState): Cell | null {
  const { order } = creep;
  switch (order.type) {
    case "stop":
      return null;
    case "moveTo":
    case "buildRoad":
      return { x: order.x, y: order.y };
    case "gather":
      return state.deposits.find((d) => d.id === order.depositId) ?? null;
    case "deliver":
      return state.teams[creep.team]?.core ?? null;
  }
}

/** Dashed line from the selected creep to where its order takes it. */
function OrderLine(props: { creep: Creep; from: Point; state: DynamicState }) {
  const target = orderTarget(props.creep, props.state);
  if (target === null) return null;
  const x2 = target.x + 0.5;
  const y2 = target.y + 0.5;
  if (Math.hypot(x2 - props.from.x, y2 - props.from.y) < 0.5) return null;
  return (
    <g class="order-line">
      <line
        x1={props.from.x}
        y1={props.from.y}
        x2={x2}
        y2={y2}
        stroke={COLORS.selection}
        stroke-opacity="0.8"
        stroke-width="0.06"
        stroke-dasharray="0.2 0.15"
      />
      <circle cx={x2} cy={y2} r="0.12" fill={COLORS.selection} />
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
