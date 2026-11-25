// How the arena draws the creeps moving (checkpoint C11): four options to
// compare in the lab, all on the page; the worker stays the authority and
// the simulation does not change.
//
//   instant  every creep jumps to its cell when the frame arrives
//   tick     it glides there over one tick (plan P8): the page runs one tick
//            behind, and a creep holding a key glides 50 ms and then stands
//            the rest of its step (the "pause" of the checkpoint)
//   step     it glides over a whole step at its DNA's speed (carry brake
//            included): no pause, drawn up to one step behind
//   predict  as tick, but the dominated creep goes on ahead: while a
//            direction is held and the cells in front are free in the last
//            frame, the page slides it there at its speed without waiting
//            for the frame (the first step at once, D22); each frame pulls
//            it back if it ran too far ahead or off its way. Released, it
//            glides to where the frames have it
//
// ADR-0008 item 9 says "no prediction"; the predict option is a lab
// experiment under the draft amendment (Proposed).

import {
  CELL_COST,
  pointsPerTick,
  type Arena,
  type BattleParams,
  type BattleView,
  type Dir,
  type ViewParticipant,
} from "@geometrix/battle";
import { cellPoint, type Point } from "./interpolate.ts";

export const MOTION_MODES = ["instant", "tick", "step", "predict"] as const;
export type MotionMode = (typeof MOTION_MODES)[number];

export const MOTION_LABELS: Record<MotionMode, string> = {
  instant: "sem interpolar",
  tick: "interpolar (1 tick)",
  step: "deslizar o passo inteiro",
  predict: "prever o meu creep",
};

const STEP: Record<Dir, Point> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

/**
 * Ticks a creep takes per cell, holding a direction: CELL_COST over its
 * gain per tick, with the carry brake (movement.ts). Not rounded: the
 * points left over carry to the next step, so this is the average pace.
 */
export function stepTicks(
  params: BattleParams,
  creep: Pick<ViewParticipant, "dna" | "carry" | "capacity">,
): number {
  const kit = params.dna[creep.dna];
  const load = creep.carry.materia + creep.carry.cristal;
  const brake =
    1000 - Math.floor((params.carry.fullBrakePermille * load) / creep.capacity);
  const gain = Math.floor(
    (pointsPerTick(params, kit.cellsPerSecond) * brake) / 1000,
  );
  return gain <= 0 ? Number.POSITIVE_INFINITY : CELL_COST / gain;
}

type Glide = { from: Point; to: Point; start: number; ms: number };

function along(glide: Glide, now: number): Point {
  const t =
    glide.ms <= 0
      ? 1
      : Math.min(Math.max((now - glide.start) / glide.ms, 0), 1);
  return {
    x: glide.from.x + (glide.to.x - glide.from.x) * t,
    y: glide.from.y + (glide.to.y - glide.from.y) * t,
  };
}

/**
 * The step option: each creep glides from where it is drawn to its new
 * cell over its step time. A creep that enters, or jumps more than two
 * cells, is drawn at its cell.
 */
export class StepGlides {
  private glides = new Map<number, Glide>();

  /** A new frame at `at`; `stepMs` is a creep's step time on the page. */
  frame(
    width: number,
    view: BattleView,
    at: number,
    stepMs: (p: ViewParticipant) => number,
  ): void {
    const next = new Map<number, Glide>();
    for (const p of view.participants) {
      const to = cellPoint(width, p.cell);
      const old = this.glides.get(p.id);
      if (old === undefined) {
        next.set(p.id, { from: to, to, start: at, ms: 0 });
        continue;
      }
      if (old.to.x === to.x && old.to.y === to.y) {
        next.set(p.id, old);
        continue;
      }
      const from = along(old, at);
      if (Math.abs(from.x - to.x) + Math.abs(from.y - to.y) > 2) {
        next.set(p.id, { from: to, to, start: at, ms: 0 });
        continue;
      }
      next.set(p.id, { from, to, start: at, ms: stepMs(p) });
    }
    this.glides = next;
  }

  position(id: number, now: number): Point | undefined {
    const glide = this.glides.get(id);
    return glide === undefined ? undefined : along(glide, now);
  }

  /** When the last glide of anyone is over. */
  get until(): number {
    let end = 0;
    for (const g of this.glides.values()) end = Math.max(end, g.start + g.ms);
    return end;
  }

  reset(): void {
    this.glides.clear();
  }
}

/** Free cells ahead of `from` along `dir` in `view`: no rock, no creep, in the grid. */
export function freeAhead(
  arena: Arena,
  view: BattleView,
  self: number,
  from: number,
  dir: Dir,
): number {
  const bodies = new Set(
    view.participants.filter((p) => p.id !== self).map((p) => p.cell),
  );
  const { x, y } = cellPoint(arena.width, from);
  const d = STEP[dir];
  let n = 0;
  for (;;) {
    const cx = x + d.x * (n + 1);
    const cy = y + d.y * (n + 1);
    if (cx < 0 || cy < 0 || cx >= arena.width || cy >= arena.height) break;
    const cell = cy * arena.width + cx;
    if (arena.rock[cell] !== 0 || bodies.has(cell)) break;
    n += 1;
  }
  return n;
}

/**
 * The predict option for the dominated creep. While a direction is held it
 * glides from an anchor cell at its step time from the key on, without
 * waiting for the frames. The battle enters each cell at the start of its
 * step (the first one at once), so the glide stays up to one step behind
 * it, never ahead: let go, the creep has nothing to undo. Released, it
 * stays where it is drawn until the frames get there (they come a round
 * trip late), then glides to them.
 */
export class Predictor {
  private dir: Dir | null = null;
  private anchor = -1;
  private since = 0;
  /**
   * Let go: where it was drawn, the way it went, until when it waits for the
   * frames, and when it started gliding to them.
   */
  private settle: {
    from: Point;
    dir: Dir;
    until: number;
    glide: number | null;
  } | null = null;
  private last: Point | null = null;

  /**
   * The direction held changed (null: none). `cell` is where the frames
   * have the creep now, used when it was not running ahead already;
   * `waitMs`, how long a release waits for the frames (the round trip).
   */
  hold(
    dir: Dir | null,
    now: number,
    width: number,
    cell: number,
    waitMs = 0,
  ): void {
    if (dir === this.dir) return;
    const here = this.last;
    if (dir === null) {
      this.settle =
        here === null || this.dir === null
          ? null
          : { from: here, dir: this.dir, until: now + waitMs, glide: null };
      this.dir = null;
      return;
    }
    // Turning, or held again while settling: from the cell it is drawn
    // nearest to.
    this.anchor =
      here !== null && (this.dir !== null || this.settle !== null)
        ? Math.round(here.y) * width + Math.round(here.x)
        : cell;
    this.dir = dir;
    this.since = now;
    this.settle = null;
  }

  /**
   * A frame arrived. During the countdown nobody walks: the run waits for
   * its end. Then the frames' cell has to be on the way ahead: if it is not
   * (blocked, or the frames went elsewhere), or the drawn creep is more than
   * `leadCells` ahead of it, the run starts again from the frames' cell. A
   * glide more than a step behind the frames catches up to one step.
   */
  frame(
    width: number,
    view: BattleView,
    self: number,
    now: number,
    stepMs: number,
    leadCells: number,
  ): void {
    if (this.dir === null) return;
    const creep = view.participants.find((p) => p.id === self);
    if (creep === undefined) {
      this.dir = null;
      return;
    }
    if (view.countdownTicks > 0) {
      this.anchor = creep.cell;
      this.since = now;
      return;
    }
    const ran = (now - this.since) / stepMs;
    const a = cellPoint(width, this.anchor);
    const c = cellPoint(width, creep.cell);
    const d = STEP[this.dir];
    const k = (c.x - a.x) * d.x + (c.y - a.y) * d.y;
    const onWay = a.x + d.x * k === c.x && a.y + d.y * k === c.y && k >= 0;
    if (!onWay || ran - k > leadCells + 1) {
      this.anchor = creep.cell;
      this.since = now;
    } else if (k - 1 > ran) {
      this.since = now - (k - 1) * stepMs;
    }
  }

  /**
   * Where to draw the dominated creep, or undefined to leave it to the
   * frames (`framed` is where they draw it now).
   */
  position(
    arena: Arena,
    view: BattleView,
    self: number,
    now: number,
    stepMs: number,
    framed: Point,
  ): Point | undefined {
    if (this.dir === null) {
      const s = this.settle;
      if (s === null) return undefined;
      if (s.glide === null) {
        const d = STEP[s.dir];
        const behind =
          (framed.x - s.from.x) * d.x + (framed.y - s.from.y) * d.y;
        if (behind < 0 && now < s.until) {
          this.last = s.from;
          return s.from;
        }
        s.glide = now;
      }
      const t = Math.min((now - s.glide) / stepMs, 1);
      if (t >= 1) {
        this.settle = null;
        this.last = null;
        return undefined;
      }
      const p = {
        x: s.from.x + (framed.x - s.from.x) * t,
        y: s.from.y + (framed.y - s.from.y) * t,
      };
      this.last = p;
      return p;
    }
    const free = freeAhead(arena, view, self, this.anchor, this.dir);
    const ran = Math.max(0, Math.min((now - this.since) / stepMs, free));
    const a = cellPoint(arena.width, this.anchor);
    const d = STEP[this.dir];
    const p = { x: a.x + d.x * ran, y: a.y + d.y * ran };
    this.last = p;
    return p;
  }

  /** Still drawing something of its own (to keep the animation going). */
  get active(): boolean {
    return this.dir !== null || this.settle !== null;
  }

  reset(): void {
    this.dir = null;
    this.settle = null;
    this.last = null;
  }
}
