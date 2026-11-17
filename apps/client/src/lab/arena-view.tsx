// The arena on the lab's page (spec L-8, plan P8, P9): SVG in cells, with the
// shapes of the world's map. Rock, the exit ring and the spawn zones are
// drawn once; on top, the piles, the projectiles and the creeps, each with
// where it faces, its HP, its load, the escape count on the ring and the idle
// clock when it is close to running out. Positions glide over one tick
// (interpolate.ts) unless the page turns that off. During the start countdown
// (spec D21) its seconds stand over the arena.

import type { Arena, BattleParams, BattleView, Dir } from "@geometrix/battle";
import { useEffect, useMemo, useState } from "preact/hooks";
import { COLORS } from "../map/colors.ts";
import { DnaShape } from "../map/creep-shape.tsx";
import { arcDash } from "../map/shapes.ts";
import { cellPoint, glideProgress, positions } from "./interpolate.ts";

/** Side colors: the world's two teams, then two more for 3 and 4 sides. */
export const SIDE_COLORS = ["#4ea8ff", "#ff8c42", "#c8e05a", "#e57bd9"];
export const sideColor = (side: number) => SIDE_COLORS[side] ?? COLORS.outline;

const STEP: Record<Dir, [number, number]> = {
  up: [0, -1],
  right: [1, 0],
  down: [0, 1],
  left: [-1, 0],
};

/** The seconds of the start countdown still to go, shown as 3, 2, 1. */
export function countdownSeconds(view: BattleView, tps: number): number {
  return Math.ceil(view.countdownTicks / tps);
}

/** The idle clock shows once this much of it has run (per mille). */
const IDLE_WARNING_PERMILLE = 666;

type Props = {
  arena: Arena;
  params: BattleParams;
  previous: BattleView | null;
  current: BattleView;
  arrivedAt: number;
  glideMs: number;
  interpolate: boolean;
  dominated: number | null;
  selected: number | null;
  onSelect(id: number): void;
};

function StaticArena({ arena }: { arena: Arena }) {
  const { width, height } = arena;
  const zones = new Map<number, number>();
  arena.entries.forEach((entry, side) => {
    for (const cell of entry.cells) zones.set(cell, side);
  });
  const cells = [];
  for (let cell = 0; cell < width * height; cell++) {
    const { x, y } = cellPoint(width, cell);
    if (arena.rock[cell] === 1) {
      cells.push(
        <rect
          key={cell}
          x={x + 0.04}
          y={y + 0.04}
          width={0.92}
          height={0.92}
          fill={COLORS.rock}
          stroke={COLORS.rockLit}
          stroke-width={0.05}
        />,
      );
    } else if (zones.has(cell)) {
      cells.push(
        <rect
          key={cell}
          x={x + 0.08}
          y={y + 0.08}
          width={0.84}
          height={0.84}
          fill={sideColor(zones.get(cell)!)}
          fill-opacity={0.12}
        />,
      );
    }
  }
  const lines = [];
  for (let x = 1; x < width; x++) {
    lines.push(<line key={`x${x}`} x1={x} y1={0} x2={x} y2={height} />);
  }
  for (let y = 1; y < height; y++) {
    lines.push(<line key={`y${y}`} x1={0} y1={y} x2={width} y2={y} />);
  }
  return (
    <g>
      {/* The exit ring: the outer lap, a lighter floor with a dashed edge. */}
      <rect x={0} y={0} width={width} height={height} fill="#1f242c" />
      <rect
        x={1}
        y={1}
        width={width - 2}
        height={height - 2}
        fill={COLORS.background}
      />
      <g stroke="#181c22" stroke-width={0.04}>
        {lines}
      </g>
      <rect
        x={0.5}
        y={0.5}
        width={width - 1}
        height={height - 1}
        fill="none"
        stroke={COLORS.border}
        stroke-width={0.06}
        stroke-dasharray="0.3 0.3"
      />
      {cells}
    </g>
  );
}

export function ArenaView(props: Props) {
  const { arena, params, previous, current, arrivedAt, glideMs } = props;
  const [now, setNow] = useState(() => performance.now());
  const t = glideProgress(arrivedAt, now, glideMs, props.interpolate);
  // Redraw every animation frame while a glide is under way.
  useEffect(() => {
    if (t >= 1) return;
    const frame = requestAnimationFrame(() => setNow(performance.now()));
    return () => cancelAnimationFrame(frame);
  }, [t, arrivedAt]);
  useEffect(() => setNow(performance.now()), [arrivedAt]);

  const staticLayer = useMemo(() => <StaticArena arena={arena} />, [arena]);
  const drawn = positions(arena.width, previous, current, t);
  const tps = params.tick.ticksPerSecond;
  const dwellTicks = (params.exit.dwellMs * tps) / 1000;
  const idleTicks = (params.inactivity.timeoutMs * tps) / 1000;

  return (
    <svg
      class="lab-arena"
      viewBox={`0 0 ${arena.width} ${arena.height}`}
      role="img"
      aria-label="A arena da batalha"
    >
      {staticLayer}
      {current.piles.map((pile) => {
        const { x, y } = cellPoint(arena.width, pile.cell);
        const size = 0.22 + Math.min(pile.materia + pile.cristal, 30) / 100;
        return (
          <rect
            key={`pile${pile.id}`}
            x={x + 0.5 - size / 2}
            y={y + 0.5 - size / 2}
            width={size}
            height={size}
            fill={pile.cristal > 0 ? COLORS.cristal : COLORS.materia}
            transform={`rotate(45 ${x + 0.5} ${y + 0.5})`}
          />
        );
      })}
      {current.projectiles.map((shot) => {
        const at = drawn.projectiles.get(shot.id)!;
        const [dx, dy] = STEP[shot.dir];
        const cx = at.x + 0.5;
        const cy = at.y + 0.5;
        return (
          <line
            key={`shot${shot.id}`}
            x1={cx - dx * 0.35}
            y1={cy - dy * 0.35}
            x2={cx + dx * 0.25}
            y2={cy + dy * 0.25}
            stroke={sideColor(shot.side)}
            stroke-width={0.16}
            stroke-linecap="round"
          />
        );
      })}
      {current.participants.map((p) => {
        const at = drawn.participants.get(p.id)!;
        const cx = at.x + 0.5;
        const cy = at.y + 0.5;
        const [dx, dy] = STEP[p.facing];
        const kit = params.dna[p.dna];
        const hp = p.hp / kit.hp;
        const band =
          hp > 0.5 ? COLORS.hp.high : hp > 0.25 ? COLORS.hp.mid : COLORS.hp.low;
        const load = p.carry.materia + p.carry.cristal;
        const idle = (p.idleTicks * 1000) / idleTicks;
        return (
          <g
            key={`p${p.id}`}
            class="lab-creep"
            onClick={() => props.onSelect(p.id)}
          >
            {p.id === props.selected && (
              <circle
                cx={cx}
                cy={cy}
                r={0.78}
                fill="none"
                stroke={COLORS.selection}
                stroke-width={0.06}
                stroke-dasharray="0.18 0.12"
              />
            )}
            {p.exitTicks > 0 && (
              <circle
                cx={cx}
                cy={cy}
                r={0.62}
                fill="none"
                stroke={COLORS.selection}
                stroke-width={0.1}
                stroke-dasharray={arcDash(0.62, p.exitTicks / dwellTicks)}
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            )}
            <DnaShape
              dna={p.dna}
              cx={cx}
              cy={cy}
              r={0.47}
              fill={sideColor(p.side)}
              stroke={
                p.id === props.dominated ? COLORS.dominated : COLORS.background
              }
              strokeWidth={p.id === props.dominated ? 0.1 : 0.05}
            />
            <line
              x1={cx}
              y1={cy}
              x2={cx + dx * 0.56}
              y2={cy + dy * 0.56}
              stroke={COLORS.outline}
              stroke-width={0.1}
              stroke-linecap="round"
            />
            <rect
              x={cx - 0.42}
              y={cy - 0.8}
              width={0.84}
              height={0.15}
              fill="#000"
              fill-opacity={0.6}
            />
            <rect
              x={cx - 0.42}
              y={cy - 0.8}
              width={0.84 * hp}
              height={0.15}
              fill={band}
            />
            {load > 0 && (
              <circle
                cx={cx + 0.38}
                cy={cy + 0.38}
                r={0.07 + (0.12 * load) / kit.capacity}
                fill={p.carry.cristal > 0 ? COLORS.cristal : COLORS.materia}
              />
            )}
            {idle >= IDLE_WARNING_PERMILLE && (
              <circle
                cx={cx - 0.4}
                cy={cy + 0.4}
                r={0.16}
                fill="none"
                stroke={COLORS.fight}
                stroke-width={0.08}
                stroke-dasharray={arcDash(0.16, 1 - idle / 1000)}
                transform={`rotate(-90 ${cx - 0.4} ${cy + 0.4})`}
              />
            )}
            <text
              class="lab-name"
              x={cx}
              y={cy + 1.12}
              text-anchor="middle"
              fill={sideColor(p.side)}
            >
              {p.name}
            </text>
          </g>
        );
      })}
      {current.countdownTicks > 0 && (
        <text
          class="lab-countdown"
          x={arena.width / 2}
          y={arena.height / 2}
          text-anchor="middle"
          dominant-baseline="central"
          font-size={Math.min(arena.width, arena.height) / 3}
        >
          {countdownSeconds(current, tps)}
        </text>
      )}
    </svg>
  );
}
