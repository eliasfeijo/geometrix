// Creeps (spec C-1): shape = DNA, fill = team, a ring with the cargo (materia
// then cristal, as a share of the capacity), a halo while someone dominates
// it, and an hourglass while it waits at a drained deposit. Creeps sharing a
// cell sit side by side, or form a stack when zoomed out (layout.ts).

import {
  isOwnCreep,
  type Cell,
  type CreepView,
  type ForeignTeam,
  type Params,
  type Team,
  type TeamView,
} from "@geometrix/sim";
import { useSignal } from "@preact/signals";
import type { ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";
import { useGame } from "../context.ts";
import { creepStatus, viewCapacity, type Creep } from "../creep-status.ts";
import type { GameStore } from "../store.ts";
import { COLORS, teamColor, teamTextColor } from "./colors.ts";
import { DnaShape } from "./creep-shape.tsx";
import { BattleBubbles, BattleSigns, InBattleMark } from "./battle-layer.tsx";
import { EncounterLayer } from "./encounter-layer.tsx";
import { HostileLayer } from "./hostile-layer.tsx";
import { creepPositions, glideProgress } from "./interpolate.ts";
import { nameFontSize } from "./labels.ts";
import { layoutCreeps, markerOf, type Marker } from "./layout.ts";
import { hpBand, hpShare } from "./combat-marks.ts";
import { arcDash } from "./shapes.ts";
import { markerScale, type Point } from "./view.ts";

const SHAPE_RADIUS = 0.3;
const CARGO_RADIUS = 0.43;
const CARGO_WIDTH = 0.1;
const CARGO_FULL_WIDTH = 0.17;
/** The HP bar under the ring (spec C-1), in cells at scale 1. */
const HP_BAR_WIDTH = 0.7;
const HP_BAR_HEIGHT = 0.09;
const HP_BAR_GAP = 0.08;

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
  const { store, viewer } = useGame();
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
  const viewScale = store.view.value?.scale ?? 1;
  const hoveredMarker =
    hovered === null
      ? undefined
      : (markerOf(markers, hovered) ?? wandererRing(state, hovered, viewScale));
  const selectedWanderer =
    selection?.kind === "wanderer"
      ? wandererRing(state, selection.id, viewScale)
      : undefined;
  // Creeps per cell, for the room their names have.
  const inCell = new Map<string, number>();
  for (const c of state.creeps) {
    const key = `${c.x},${c.y}`;
    inCell.set(key, (inCell.get(key) ?? 0) + 1);
  }
  const named = (creep: Creep, center: Point & { scale: number }) => (
    <CreepName
      creep={creep}
      center={center}
      name={creep.name}
      belowBar={hpShare(creep, info.params) !== null}
      fontSize={nameFontSize(
        inCell.get(`${creep.x},${creep.y}`) ?? 1,
        viewScale,
      )}
    />
  );
  const mark = (creep: Creep, center: Point & { scale: number }) => (
    <CreepMark
      creep={creep}
      center={center}
      team={state.teams[creep.team]}
      params={info.params}
      mine={isOwnCreep(creep) && creep.dominatedBy === viewer.playerId}
      waiting={creepStatus(creep, state.deposits) === "waiting"}
    />
  );
  const battle = selection?.kind === "battle" ? selection.id : null;
  return (
    <g class="creep-layer">
      <BattleBubbles battles={state.battles} />
      <EncounterLayer
        state={state}
        params={info.params}
        markers={markers}
        viewScale={viewScale}
      />
      {selected !== undefined &&
        isOwnCreep(selected) &&
        selectedMarker !== undefined && (
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
      {/* Names over every creep, so a neighbor below does not hide them. */}
      <g class="creep-names">
        {markers.map((m) =>
          m.kind === "creep" ? (
            <g key={m.id}>{named(byId.get(m.id)!, m)}</g>
          ) : null,
        )}
      </g>
      <HostileLayer state={state} markers={markers} viewScale={viewScale} />
      <BattleSigns
        battles={state.battles}
        viewScale={viewScale}
        selected={battle}
      />
      {hoveredMarker !== undefined && <HoverRing center={hoveredMarker} />}
      {selectedMarker !== undefined && (
        <SelectionRing center={selectedMarker} />
      )}
      {selectedWanderer !== undefined && (
        <SelectionRing center={selectedWanderer} />
      )}
      {store.ping.value !== null && (
        <Ping key={store.ping.value.id} cell={store.ping.value.cell} />
      )}
      {selection !== null &&
        (selection.kind === "core" ||
          selection.kind === "deposit" ||
          selection.kind === "spoil") && (
          <CellSelection
            cell={
              selection.kind === "core"
                ? (state.teams[selection.team]?.core ?? undefined)
                : selection.kind === "deposit"
                  ? state.deposits.find((d) => d.id === selection.id)
                  : state.spoils.find((s) => s.id === selection.id)
            }
            size={selection.kind === "core" ? 2.6 : 1.1}
          />
        )}
    </g>
  );
}

/** Where the rings go around a wanderer, which has no marker. */
function wandererRing(state: TeamView, id: number, viewScale: number) {
  const w = state.wanderers.find((w) => w.id === id);
  return w === undefined
    ? undefined
    : { x: w.x + 0.5, y: w.y + 0.5, scale: markerScale(viewScale) };
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
export function orderTarget(creep: CreepView, state: TeamView): Cell | null {
  const { order } = creep;
  switch (order.type) {
    case "stop":
      return null;
    case "moveTo":
    case "explore":
    case "buildRoad":
      return { x: order.x, y: order.y };
    case "gather":
      return state.deposits.find((d) => d.id === order.depositId) ?? null;
    case "deliver":
    case "flee":
      return state.teams[creep.team]?.core ?? null;
    case "approach":
    case "follow":
      return state.creeps.find((c) => c.id === order.targetId) ?? null;
    case "pickup":
    case "drop":
      return null;
  }
}

/** Dashed line from the selected creep to where its order takes it. */
function OrderLine(props: { creep: CreepView; from: Point; state: TeamView }) {
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
  team: Team | ForeignTeam | undefined;
  params: Params;
  /** Dominated by this player. */
  mine: boolean;
  waiting: boolean;
};

function CreepMark({ creep, center, team, params, mine, waiting }: MarkProps) {
  const { x: cx, y: cy, scale } = center;
  const color = teamColor(creep.team);
  const max = viewCapacity(creep, team, params);
  const materia = creep.cargo.materia / max;
  const cristal = creep.cargo.cristal / max;
  const ring = CARGO_RADIUS * scale;
  const circumference = 2 * Math.PI * ring;
  const rotate = `rotate(-90 ${cx} ${cy})`;
  // A full load thickens the ring (F9); the flash plays once when it fills.
  const full = creep.cargo.materia + creep.cargo.cristal >= max;
  const ringWidth = (full ? CARGO_FULL_WIDTH : CARGO_WIDTH) * scale;
  return (
    <g class="creep">
      {isOwnCreep(creep) && creep.dominatedBy !== null && (
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
        stroke-width={ringWidth}
      />
      {materia > 0 && (
        <circle
          cx={cx}
          cy={cy}
          r={ring}
          fill="none"
          stroke={COLORS.materia}
          stroke-width={ringWidth}
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
          stroke-width={ringWidth}
          stroke-dasharray={arcDash(ring, cristal)}
          stroke-dashoffset={-circumference * materia}
          transform={rotate}
        />
      )}
      {full && (
        <circle
          class="cargo-flash"
          cx={cx}
          cy={cy}
          r={ring}
          fill="none"
          stroke={cristal > materia ? COLORS.cristal : COLORS.materia}
          stroke-width={ringWidth}
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
      {creep.battle !== null && (
        <InBattleMark x={cx - ring * 0.75} y={cy - ring * 0.75} size={scale} />
      )}
      <HpBar creep={creep} center={center} params={params} />
    </g>
  );
}

/** A bar under the ring while the creep is not at full HP (spec C-1). */
function HpBar(props: {
  creep: Creep;
  center: Point & { scale: number };
  params: Params;
}) {
  const share = hpShare(props.creep, props.params);
  if (share === null) return null;
  const { x, y, scale } = props.center;
  const width = HP_BAR_WIDTH * scale;
  const height = HP_BAR_HEIGHT * scale;
  const left = x - width / 2;
  const top = y + (CARGO_RADIUS + HP_BAR_GAP) * scale;
  return (
    <g class="hp-bar">
      <rect
        x={left - 0.02 * scale}
        y={top - 0.02 * scale}
        width={width + 0.04 * scale}
        height={height + 0.04 * scale}
        fill={COLORS.background}
      />
      <rect
        x={left}
        y={top}
        width={width * share}
        height={height}
        fill={COLORS.hp[hpBand(share)]}
      />
    </g>
  );
}

/** The creep's name under its shape (and halo), in the game font. */
function CreepName(props: {
  creep: Creep;
  center: Point & { scale: number };
  name: string;
  fontSize: number | null;
  /** Whether the HP bar sits between the ring and the name. */
  belowBar: boolean;
}) {
  const { center, fontSize } = props;
  if (fontSize === null) return null;
  const bar = props.belowBar ? HP_BAR_GAP + HP_BAR_HEIGHT : 0;
  return (
    <text
      class="map-text creep-name"
      x={center.x}
      y={center.y + (CARGO_RADIUS + 0.16 + bar) * center.scale}
      font-size={fontSize}
      stroke-width={fontSize * 0.28}
      fill={teamTextColor(props.creep.team)}
      text-anchor="middle"
      dominant-baseline="hanging"
    >
      {props.name}
    </text>
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
