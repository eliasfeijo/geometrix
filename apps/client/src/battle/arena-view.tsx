// The arena of a battle screen, the lab's and the world client's (lab spec L-8,
// lab plan P8, P9, C6; junction plan P10): SVG in cells, with the shapes of the
// world's map, as wide as the page allows. Rock, the exit ring and the spawn
// zones are drawn once; on top, the piles, the projectiles and the creeps, each
// with where it faces, its HP, its load and the escape count on the ring; then
// the signals of the attack (effects.ts): who attacks pulses, whoever is hit
// flashes with the damage rising over it, and a shot that vanishes leaves a
// spark. The battle's idle clock shows over the arena when it is close to
// running out. Positions glide by the page's motion option (motion.ts): over
// one tick (interpolate.ts), over a whole step, not at all, or with the
// dominated creep predicted. During the start countdown (spec D21) its seconds
// stand over the arena.

import type { Arena, BattleParams, BattleView, Dir } from "@geometrix/battle";
import { useEffect, useMemo, useState } from "preact/hooks";
import { COLORS } from "../map/colors.ts";
import { DnaShape } from "../map/creep-shape.tsx";
import { arcDash } from "../map/shapes.ts";
import { effectProgress, liveEffects, type Effect } from "./effects.ts";
import { cellPoint, glideProgress, positions } from "./interpolate.ts";
import {
  stepTicks,
  type MotionMode,
  type Predictor,
  type StepGlides,
} from "./motion.ts";
import "./battle.css";
import { sideLetter } from "./labels.ts";

/** Side colors: the world's two teams, then two more for 3 and 4 sides. */
export const SIDE_COLORS = ["#4ea8ff", "#ff8c42", "#c8e05a", "#e57bd9"];
export const sideColor = (side: number) => SIDE_COLORS[side] ?? COLORS.outline;

/**
 * How a page colors and names a battle's sides: the lab by side (A, B…),
 * the world client by the team on each side (junction plan P10).
 */
export type SideStyle = {
  color(side: number): string;
  /** The winner in the end banner ("o lado A", "Azul"). */
  name(side: number): string;
  /** The side's tag after a participant's name ("A", "Azul"). */
  tag(side: number): string;
};

export const LAB_SIDES: SideStyle = {
  color: sideColor,
  name: (side) => `o lado ${sideLetter(side)}`,
  tag: sideLetter,
};

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

/** The battle's idle clock warns once this much of it has run (per mille). */
const IDLE_WARNING_PERMILLE = 666;

/** Whole seconds left before everyone flees for inactivity (spec D9). */
export function idleSecondsLeft(
  view: BattleView,
  params: BattleParams,
): number {
  const tps = params.tick.ticksPerSecond;
  const timeout = (params.inactivity.timeoutMs * tps) / 1000;
  return Math.ceil(Math.max(0, timeout - view.idleTicks) / tps);
}

/** Whether the battle's idle clock is close to running out (spec L-8). */
export function idleWarning(view: BattleView, params: BattleParams): boolean {
  const tps = params.tick.ticksPerSecond;
  const timeout = (params.inactivity.timeoutMs * tps) / 1000;
  return (
    view.ended === null &&
    view.countdownTicks === 0 &&
    view.idleTicks * 1000 >= timeout * IDLE_WARNING_PERMILLE
  );
}

type Props = {
  arena: Arena;
  params: BattleParams;
  previous: BattleView | null;
  current: BattleView;
  arrivedAt: number;
  /** One tick on the page's clock (at the battle's speed). */
  glideMs: number;
  motion: MotionMode;
  /** The step option's glides, fed by the page at each frame. */
  stepGlides: StepGlides;
  /** The predict option's dominated creep, fed by the page. */
  predictor: Predictor;
  /** The signals of the attack of the last frames (effects.ts). */
  effects: readonly Effect[];
  dominated: number | null;
  selected: number | null;
  onSelect(id: number): void;
  /** The sides' colors and names; the lab's by default. */
  sides?: SideStyle;
};

function StaticArena({
  arena,
  color,
}: {
  arena: Arena;
  color: SideStyle["color"];
}) {
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
          fill={color(zones.get(cell)!)}
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

type Point = { x: number; y: number };

/** Where the damage of close hits on one target rises, side by side (cells). */
const DAMAGE_SHIFT: [number, number][] = [
  [0, 0],
  [1, 0.4],
  [-1, 0.4],
];

/** The way out of the arena from `at`: towards its nearest edge. */
function outward(at: Point, width: number, height: number): Dir {
  const gaps: [Dir, number][] = [
    ["up", at.y],
    ["down", height - 1 - at.y],
    ["left", at.x],
    ["right", width - 1 - at.x],
  ];
  return gaps.reduce((a, b) => (b[1] < a[1] ? b : a))[0];
}

/**
 * Who fell or fled, where its name was (under the cell; over it on the
 * bottom rows), kept inside the arena at the sides, fading at the end.
 */
function Notice(props: {
  cx: number;
  cy: number;
  p: number;
  color: string;
  text: string;
  width: number;
  height: number;
}) {
  const fade = props.p < 0.7 ? 1 : 1 - (props.p - 0.7) / 0.3;
  const edge = 4;
  const [x, anchor] =
    props.cx < edge
      ? [0.2, "start"]
      : props.cx > props.width - edge
        ? [props.width - 0.2, "end"]
        : [props.cx, "middle"];
  const y = props.cy > props.height - 2 ? props.cy - 1.2 : props.cy + 1.25;
  return (
    <text
      class="battle-notice"
      x={x}
      y={y}
      text-anchor={anchor}
      fill={props.color}
      opacity={fade}
    >
      {props.text}
    </text>
  );
}

/** One signal of the attack, drawn at `now` (spec L-8, plan C6, C13). */
function EffectMark({
  effect,
  now,
  at,
  slot,
  width,
  height,
  sideColor,
}: {
  effect: Effect;
  now: number;
  /** The cell's top-left corner where the effect stands. */
  at: Point;
  /** Earlier hits on the same target still showing: their numbers step aside. */
  slot: number;
  width: number;
  height: number;
  sideColor: SideStyle["color"];
}) {
  const p = effectProgress(effect, now);
  const cx = at.x + 0.5;
  const cy = at.y + 0.5;
  if (effect.kind === "death") {
    // The shape bursts: its outline grows and fades, and shards fly out.
    const color = sideColor(effect.side);
    const shards = [0, 1, 2, 3, 4, 5].map((k) => {
      const a = (k * Math.PI) / 3 + Math.PI / 6;
      const r0 = 0.35 + 0.7 * p;
      return (
        <line
          key={k}
          x1={cx + Math.cos(a) * r0}
          y1={cy + Math.sin(a) * r0}
          x2={cx + Math.cos(a) * (r0 + 0.3)}
          y2={cy + Math.sin(a) * (r0 + 0.3)}
          stroke={color}
          stroke-width={0.12}
          stroke-linecap="round"
        />
      );
    });
    return (
      <g class="battle-effect" data-kind={effect.kind}>
        <g opacity={1 - p}>
          <DnaShape
            dna={effect.dna}
            cx={cx}
            cy={cy}
            r={0.47 + 0.4 * p}
            stroke={color}
            strokeWidth={0.12}
          />
          {shards}
        </g>
        <Notice
          cx={cx}
          cy={cy}
          p={p}
          color={color}
          text={`${effect.name} caiu`}
          width={width}
          height={height}
        />
      </g>
    );
  }
  if (effect.kind === "escape") {
    // An arrow out of the arena, sliding the way out inside its last cell
    // (it is on the ring, the arena's edge) and fading.
    const color = sideColor(effect.side);
    const [dx, dy] = STEP[outward(at, width, height)];
    const ox = cx + dx * (-0.9 + 0.3 * p);
    const oy = cy + dy * (-0.9 + 0.3 * p);
    const text =
      effect.reason === "idle"
        ? `${effect.name} fugiu (inatividade)`
        : `${effect.name} fugiu`;
    return (
      <g class="battle-effect" data-kind={effect.kind}>
        <g opacity={1 - p}>
          <DnaShape
            dna={effect.dna}
            cx={cx}
            cy={cy}
            r={0.47}
            stroke={color}
            strokeWidth={0.08}
          />
          <line
            x1={ox - dx * 0.5}
            y1={oy - dy * 0.5}
            x2={ox + dx * 0.3}
            y2={oy + dy * 0.3}
            stroke={color}
            stroke-width={0.16}
            stroke-linecap="round"
          />
          <polygon
            points={`${ox + dx * 0.6},${oy + dy * 0.6} ${ox + dx * 0.2 - dy * 0.3},${oy + dy * 0.2 - dx * 0.3} ${ox + dx * 0.2 + dy * 0.3},${oy + dy * 0.2 + dx * 0.3}`}
            fill={color}
          />
        </g>
        <Notice
          cx={cx}
          cy={cy}
          p={p}
          color={color}
          text={text}
          width={width}
          height={height}
        />
      </g>
    );
  }
  if (effect.kind === "attack") {
    // A ring that grows and fades around the attacker, and a burst on the
    // side it strikes towards: a slash for melee, a muzzle flash for a shot.
    const [dx, dy] = STEP[effect.dir];
    const color = sideColor(effect.side);
    const fx = cx + dx * (effect.melee ? 1 : 0.6);
    const fy = cy + dy * (effect.melee ? 1 : 0.6);
    return (
      <g class="battle-effect" data-kind={effect.kind} opacity={1 - p}>
        <circle
          cx={cx}
          cy={cy}
          r={0.55 + 0.4 * p}
          fill="none"
          stroke={color}
          stroke-width={0.14}
        />
        {effect.melee ? (
          <line
            x1={fx - dy * 0.42}
            y1={fy - dx * 0.42}
            x2={fx + dy * 0.42}
            y2={fy + dx * 0.42}
            stroke="#ffffff"
            stroke-width={0.16}
            stroke-linecap="round"
          />
        ) : (
          <circle cx={fx} cy={fy} r={0.22 * (1 - p) + 0.08} fill="#ffffff" />
        )}
      </g>
    );
  }
  if (effect.kind === "hit") {
    // A white flash over the target in the first third, and the damage
    // rising over it, fading in the last part.
    const flash = Math.max(0, 1 - p * 3);
    const [sx, sy] = DAMAGE_SHIFT[slot % DAMAGE_SHIFT.length]!;
    const rise = cy - 1.15 + sy - 0.8 * p;
    const fade = p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4;
    return (
      <g class="battle-effect" data-kind={effect.kind}>
        {flash > 0 && (
          <circle
            cx={cx}
            cy={cy}
            r={0.62}
            fill="#ffffff"
            fill-opacity={0.75 * flash}
          />
        )}
        <text
          class="battle-damage"
          x={cx + sx}
          y={rise}
          text-anchor="middle"
          opacity={fade}
        >
          {`−${effect.damage}`}
        </text>
      </g>
    );
  }
  // The miss: a spark on the face of the last cell, the way the shot flew.
  const [dx, dy] = STEP[effect.dir];
  const sx = cx + dx * 0.5;
  const sy = cy + dy * 0.5;
  const arm = 0.28 + 0.12 * p;
  return (
    <g class="battle-effect" data-kind={effect.kind} opacity={1 - p}>
      <circle
        cx={sx}
        cy={sy}
        r={0.15 + 0.3 * p}
        fill="none"
        stroke={sideColor(effect.side)}
        stroke-width={0.08}
      />
      <g stroke="#c9d1dc" stroke-width={0.1} stroke-linecap="round">
        <line x1={sx - arm} y1={sy - arm} x2={sx + arm} y2={sy + arm} />
        <line x1={sx - arm} y1={sy + arm} x2={sx + arm} y2={sy - arm} />
      </g>
    </g>
  );
}

export function ArenaView(props: Props) {
  const { arena, params, previous, current, arrivedAt, glideMs } = props;
  const sides = props.sides ?? LAB_SIDES;
  const sideColor = sides.color;
  const [now, setNow] = useState(() => performance.now());
  const { motion, stepGlides, predictor, dominated } = props;
  const t = glideProgress(arrivedAt, now, glideMs, motion !== "instant");
  const effects = liveEffects(props.effects, now);
  const animating =
    t < 1 ||
    effects.length > 0 ||
    (motion === "step" && stepGlides.until > now) ||
    (motion === "predict" && predictor.active);
  // Redraw every animation frame while a glide or a signal is under way.
  useEffect(() => {
    if (!animating) return;
    const frame = requestAnimationFrame(() => setNow(performance.now()));
    return () => cancelAnimationFrame(frame);
  }, [animating, now, arrivedAt]);
  useEffect(() => setNow(performance.now()), [arrivedAt, props.effects]);

  const staticLayer = useMemo(
    () => <StaticArena arena={arena} color={sideColor} />,
    [arena, sideColor],
  );
  const drawn = positions(arena.width, previous, current, t);
  if (motion === "step") {
    for (const p of current.participants) {
      const at = stepGlides.position(p.id, now);
      if (at !== undefined) drawn.participants.set(p.id, at);
    }
  }
  if (motion === "predict" && dominated !== null) {
    const creep = current.participants.find((p) => p.id === dominated);
    const framed = drawn.participants.get(dominated);
    if (creep !== undefined && framed !== undefined) {
      const stepMs = stepTicks(params, creep) * glideMs;
      const at: Point | undefined = predictor.position(
        arena,
        current,
        dominated,
        now,
        stepMs,
        framed,
      );
      if (at !== undefined) drawn.participants.set(dominated, at);
    }
  }
  const tps = params.tick.ticksPerSecond;
  const dwellTicks = (params.exit.dwellMs * tps) / 1000;

  /** Where an effect stands: on its creep while it is there, else its cell. */
  const effectAt = (effect: Effect): Point | null => {
    if (effect.kind === "death" || effect.kind === "escape") {
      return cellPoint(arena.width, effect.cell);
    }
    if (effect.kind !== "miss") {
      const creep = drawn.participants.get(effect.id);
      if (creep !== undefined) return creep;
      if (effect.kind === "attack") return null;
    }
    return cellPoint(arena.width, effect.cell);
  };

  return (
    <svg
      class="battle-arena"
      // Fits the window's height too: no wider than that height allows.
      style={{
        maxWidth: `calc((100vh - var(--battle-chrome)) * ${arena.width / arena.height})`,
      }}
      viewBox={`0 0 ${arena.width} ${arena.height}`}
      role="img"
      aria-label="A arena da batalha"
    >
      {staticLayer}
      {current.piles.map((pile) => {
        const { x, y } = cellPoint(arena.width, pile.cell);
        const size = 0.3 + Math.min(pile.materia + pile.cristal, 30) / 80;
        return (
          <rect
            key={`pile${pile.id}`}
            x={x + 0.5 - size / 2}
            y={y + 0.5 - size / 2}
            width={size}
            height={size}
            fill={pile.cristal > 0 ? COLORS.cristal : COLORS.materia}
            stroke={COLORS.background}
            stroke-width={0.05}
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
          <g key={`shot${shot.id}`}>
            <line
              x1={cx - dx * 0.55}
              y1={cy - dy * 0.55}
              x2={cx + dx * 0.25}
              y2={cy + dy * 0.25}
              stroke={sideColor(shot.side)}
              stroke-width={0.26}
              stroke-linecap="round"
            />
            <circle
              cx={cx + dx * 0.25}
              cy={cy + dy * 0.25}
              r={0.13}
              fill="#ffffff"
            />
          </g>
        );
      })}
      {current.participants.map((p) => {
        const at = drawn.participants.get(p.id)!;
        const cx = at.x + 0.5;
        const cy = at.y + 0.5;
        const [dx, dy] = STEP[p.facing];
        const hp = p.hp / p.maxHp;
        const band =
          hp > 0.5 ? COLORS.hp.high : hp > 0.25 ? COLORS.hp.mid : COLORS.hp.low;
        const load = p.carry.materia + p.carry.cristal;
        const mine = p.id === props.dominated;
        // The facing: a pointer from the body out past its edge.
        const tipX = cx + dx * 0.78;
        const tipY = cy + dy * 0.78;
        const baseX = cx + dx * 0.5;
        const baseY = cy + dy * 0.5;
        return (
          <g
            key={`p${p.id}`}
            class="battle-creep"
            onClick={() => props.onSelect(p.id)}
          >
            {p.id === props.selected && (
              <circle
                cx={cx}
                cy={cy}
                r={0.82}
                fill="none"
                stroke={COLORS.selection}
                stroke-width={0.07}
                stroke-dasharray="0.18 0.12"
              />
            )}
            {p.exitTicks > 0 && (
              <circle
                cx={cx}
                cy={cy}
                r={0.66}
                fill="none"
                stroke={COLORS.selection}
                stroke-width={0.16}
                stroke-dasharray={arcDash(0.66, p.exitTicks / dwellTicks)}
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            )}
            <DnaShape
              dna={p.dna}
              cx={cx}
              cy={cy}
              r={0.47}
              fill={sideColor(p.side)}
              stroke={mine ? COLORS.dominated : COLORS.background}
              strokeWidth={mine ? 0.12 : 0.06}
            />
            <polygon
              points={`${tipX},${tipY} ${baseX - dy * 0.2},${baseY - dx * 0.2} ${baseX + dy * 0.2},${baseY + dx * 0.2}`}
              fill={COLORS.outline}
              stroke={COLORS.background}
              stroke-width={0.04}
            />
            <line
              x1={cx}
              y1={cy}
              x2={baseX}
              y2={baseY}
              stroke={COLORS.outline}
              stroke-width={0.12}
              stroke-linecap="round"
            />
            {/* The HP bar, a little wider than the cell. */}
            <rect
              x={cx - 0.6}
              y={cy - 1}
              width={1.2}
              height={0.3}
              fill="#000"
              fill-opacity={0.75}
              stroke="#000"
              stroke-width={0.06}
            />
            <rect
              x={cx - 0.6}
              y={cy - 1}
              width={1.2 * hp}
              height={0.3}
              fill={band}
            />
            {load > 0 && (
              <circle
                cx={cx + 0.4}
                cy={cy + 0.4}
                r={0.1 + (0.14 * load) / p.capacity}
                fill={p.carry.cristal > 0 ? COLORS.cristal : COLORS.materia}
                stroke={COLORS.background}
                stroke-width={0.04}
              />
            )}
            <text
              class="battle-name"
              x={cx}
              y={cy + 1.2}
              text-anchor="middle"
              fill={sideColor(p.side)}
            >
              {p.name}
            </text>
          </g>
        );
      })}
      {effects.map((effect, i) => {
        const at = effectAt(effect);
        if (at === null) return null;
        const slot =
          effect.kind === "hit"
            ? effects
                .slice(0, i)
                .filter((e) => e.kind === "hit" && e.id === effect.id).length
            : 0;
        return (
          <EffectMark
            key={`fx${effect.at}.${i}`}
            effect={effect}
            now={now}
            at={at}
            slot={slot}
            width={arena.width}
            height={arena.height}
            sideColor={sideColor}
          />
        );
      })}
      {idleWarning(current, params) && (
        <text
          class="battle-idle"
          x={arena.width / 2}
          y={1.8}
          text-anchor="middle"
          fill={COLORS.fight}
        >
          {`sem dano: todos fogem em ${idleSecondsLeft(current, params)} s`}
        </text>
      )}
      {current.countdownTicks > 0 && (
        <text
          class="battle-countdown"
          x={arena.width / 2}
          y={arena.height / 2}
          text-anchor="middle"
          dominant-baseline="central"
          font-size={Math.min(arena.width, arena.height) / 3}
        >
          {countdownSeconds(current, tps)}
        </text>
      )}
      {current.ended !== null && (
        // The outcome stays over the arena: the result table is below it.
        <text
          class="battle-banner"
          x={arena.width / 2}
          y={2}
          text-anchor="middle"
          fill={
            current.ended.winnerSide === null
              ? COLORS.outline
              : sideColor(current.ended.winnerSide)
          }
        >
          {current.ended.winnerSide === null
            ? "fim: ninguém vence"
            : `fim: ${sides.name(current.ended.winnerSide)} vence`}
        </text>
      )}
    </svg>
  );
}
