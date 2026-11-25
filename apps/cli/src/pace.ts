// The pace of a match (M2 R spec §7, plan §3, P13): the moments a group of
// friends feels (the first extra creep, the map explored, the wanderers, the
// fights, the end), measured in world time from a run and read in real
// minutes at the run's ×N, against the spec's targets. The thresholds are the
// harness's criteria, not params: a failed one goes to the owner at the
// checkpoint. Nothing here goes into the state or its hash.

import {
  findPath,
  isPassable,
  stepCost,
  type GameMap,
  type MetricsSample,
  type Params,
  type SimEvent,
  type WorldState,
} from "@geometrix/sim";
import { number, table } from "./format.ts";
import { teamCreeps, type Shock } from "./shock.ts";

/** The spec's §7 targets, in real minutes at the ×N unless noted. */
export const TARGETS = {
  /** The world's duration ÷ ×N: 2 h ± 5 min (PA-1). */
  match: { min: 115, max: 125 },
  /** The extortion window, in real seconds (PA-3, D3). */
  reactionSeconds: 10,
  /** An empty triangle from its core to the enemy's. */
  crossing: { min: 1.5, max: 2.5 },
  /** Each team's first extra creep. */
  firstCreep: { min: 8, max: 15 },
  /** Each team has seen this share of the reachable map, in ‰… */
  exploredPermille: 800,
  /** …in this window. */
  explored: { min: 20, max: 60 },
  /** The first wanderer born. */
  firstWanderer: { min: 4, max: 6 },
  /** At least one wanderer alive during this share of the match after it. */
  wandererAlivePercent: 70,
  /** Never more wanderers alive at once. */
  wandererCap: 4,
  /** Battles per team are counted per this many real minutes. */
  battleWindow: 10,
  /** At least one help join per team per this many real minutes. */
  helpJoinEvery: 30,
  /** "Delivering at the end": matéria delivered in the last minutes. */
  lateDelivery: 10,
  /** The median creep gap at the end, over the seeds. */
  creepGap: 3,
  /** Each team's creeps at the end. */
  creepsAtEnd: { min: 10, max: 24 },
  /** The population cap is not reached before this minute. */
  capNotBefore: 90,
  /** A shocked team is back to its count within these minutes… */
  recovery: 15,
  /** …on at least this share of the seeds, in %. */
  recoverySeedsPercent: 90,
} as const;

/** One team's pace in a run, in world ticks. */
export type TeamPace = {
  team: number;
  /** The team's first creep born from production, or null. */
  firstBornTick: number | null;
  /** First sample with TARGETS.exploredPermille of the reachable cells seen. */
  exploredTick: number | null;
  /** Reachable cells the team had seen at the end, in ‰ of them. */
  exploredPermille: number;
  /** Battles the team had a side in, at the opening or by a join. */
  battles: number;
  /** Of those, the battles some creep joined after the opening. */
  battlesWithJoin: number;
  /**
   * The team's joins by the help rule or a follow; null until the world has
   * them (R F2) and the harness tells them apart (R F3).
   */
  helpJoins: number | null;
  /** First sample with creeps + production at the population cap, or null. */
  capTick: number | null;
  creepsAtEnd: number;
  /** Matéria delivered in the run's last TARGETS.lateDelivery real minutes. */
  lateMateria: number;
};

export type PaceFacts = {
  /** The ×N the run is read at. */
  multiplier: number;
  tickSeconds: number;
  /** The run's ticks, and the params' whole match in world seconds. */
  ticks: number;
  matchSeconds: number;
  reactionSeconds: number;
  /**
   * World seconds for an empty triangle from team 0's core to team 1's on
   * the map as generated (no roads), or null with no path.
   */
  crossingSeconds: number | null;
  /** Passable cells connected to team 0's core. */
  reachableCells: number;
  teams: TeamPace[];
  wanderers: {
    firstBornTick: number | null;
    /**
     * Ticks from the first birth to the end, both counted, and those with
     * one alive.
     */
    ticksAfterFirst: number;
    ticksWithOneAlive: number;
    maxAlive: number;
  };
  /** Wall-clock microseconds per world tick, through the host. */
  tickMicros: number;
  /** The recovery scenario (P12), or null in a run with no shock. */
  recovery: Recovery | null;
};

/** A shocked team's way back to its count (P12). */
export type Recovery = {
  shock: Shock;
  /** The tick it landed after, the team's creeps then, and those killed. */
  tick: number;
  before: number;
  killed: number;
  /** The first tick with the team back at `before` creeps, or null. */
  recoveredTick: number | null;
};

/** Passable cells 4-connected to `from` (the flood the map generator checks). */
export function reachableMask(map: GameMap, from: number): Uint8Array {
  const mask = new Uint8Array(map.width * map.height);
  const queue = [from];
  mask[from] = 1;
  while (queue.length > 0) {
    const at = queue.pop()!;
    const x = at % map.width;
    const next = [
      at >= map.width ? at - map.width : -1,
      x > 0 ? at - 1 : -1,
      x < map.width - 1 ? at + 1 : -1,
      at + map.width < mask.length ? at + map.width : -1,
    ];
    for (const cell of next) {
      if (cell < 0 || mask[cell] === 1) continue;
      if (!isPassable(map.terrain[cell]!)) continue;
      mask[cell] = 1;
      queue.push(cell);
    }
  }
  return mask;
}

/**
 * World seconds an empty creep of `cellsPerMinute` takes along the cheapest
 * path from `from` to `to`, by the path cost's own scale (a cell at modifier
 * 1000 takes 60 / cellsPerMinute seconds); null with no path.
 */
export function crossingSeconds(
  map: GameMap,
  from: { x: number; y: number },
  to: { x: number; y: number },
  params: Params,
  cellsPerMinute: number,
): number | null {
  const path = findPath(map, from, to, params);
  if (path === null) return null;
  const cost = path.reduce((sum, cell) => sum + stepCost(map, cell, params), 0);
  // stepCost is 1,000,000 ÷ the modifier in ‰: 1,000 for a plain cell.
  return (cost * 60) / (cellsPerMinute * 1000);
}

/**
 * Follows a run tick by tick (the same callback as the encounter tracker)
 * and gives its pace at the end. The first call is the new world (tick 0).
 */
export class PaceTracker {
  private readonly multiplier: number;
  private readonly reachable: Uint8Array;
  private readonly reachableCells: number;
  private readonly crossing: number | null;
  private readonly firstBorn: (number | null)[];
  private readonly explored: (number | null)[];
  /** Battles each team had a side in, and the battles someone joined. */
  private readonly battles: Set<number>[];
  private readonly joined = new Set<number>();
  private firstWanderer: number | null = null;
  private ticksWithOneAlive = 0;
  private maxAlive = 0;
  private recovery: Recovery | null = null;

  constructor(state: WorldState, multiplier: number) {
    const { map, params, teams } = state;
    this.multiplier = multiplier;
    const [a, b] = [teams[0]!.core, teams[1]!.core];
    this.reachable = reachableMask(map, a.y * map.width + a.x);
    this.reachableCells = this.reachable.reduce((sum, v) => sum + v, 0);
    this.crossing = crossingSeconds(
      map,
      a,
      b,
      params,
      params.dna.triangle.cellsPerMinute,
    );
    this.firstBorn = teams.map(() => null);
    this.explored = teams.map(() => null);
    this.battles = teams.map(() => new Set());
  }

  /** The tick's events, with the state after it. */
  record(state: WorldState, events: readonly SimEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case "born": {
          const team = event.creep.team!;
          this.firstBorn[team] ??= state.tick;
          break;
        }
        case "wandererBorn":
          this.firstWanderer ??= state.tick;
          break;
        case "battleOpened":
          for (const side of event.sides) {
            if (side.team !== null) this.battles[side.team]!.add(event.battle);
          }
          break;
        case "battleJoined":
          this.joined.add(event.battle);
          if (event.creep.team !== null) {
            this.battles[event.creep.team]!.add(event.battle);
          }
          break;
      }
    }
    const r = this.recovery;
    if (r !== null && r.recoveredTick === null) {
      if (teamCreeps(state, r.shock.team) >= r.before) {
        r.recoveredTick = state.tick;
      }
    }
    const alive = state.wanderers.length;
    this.maxAlive = Math.max(this.maxAlive, alive);
    if (this.firstWanderer !== null && alive > 0) this.ticksWithOneAlive += 1;
  }

  /** The shock landed after this tick: `before` creeps, `killed` of them. */
  shocked(state: WorldState, shock: Shock, before: number, killed: number) {
    this.recovery = {
      shock,
      tick: state.tick,
      before,
      killed,
      recoveredTick: null,
    };
  }

  /** At a metrics sample: the share of the reachable map each team has seen. */
  sample(state: WorldState): void {
    state.teams.forEach((team, i) => {
      if (this.explored[i] !== null) return;
      if (this.seenPermille(state, team.id) >= TARGETS.exploredPermille) {
        this.explored[i] = state.tick;
      }
    });
  }

  private seenPermille(state: WorldState, team: number): number {
    const explored = state.memory[team]!.explored;
    let seen = 0;
    for (let i = 0; i < explored.length; i++) {
      if (explored[i] === 1 && this.reachable[i] === 1) seen += 1;
    }
    return Math.floor((seen * 1000) / this.reachableCells);
  }

  finish(
    state: WorldState,
    samples: readonly MetricsSample[],
    wallSeconds: number,
  ): PaceFacts {
    const { params } = state;
    const tickSeconds = params.world.tickSeconds;
    const last = samples.at(-1)!;
    const lateTicks = Math.floor(
      (TARGETS.lateDelivery * 60 * this.multiplier) / tickSeconds,
    );
    // The last sample at or before the late window opens; the first if the
    // run is shorter than the window.
    const lateFrom =
      samples.findLast((s) => s.tick <= last.tick - lateTicks) ?? samples[0]!;
    const creeps = (t: MetricsSample["teams"][number]) =>
      t.creeps.square + t.creeps.triangle + t.creeps.circle;
    const teams = state.teams.map((team, i): TeamPace => {
      const capSample = samples.find((s) => {
        const t = s.teams[i]!;
        return (
          creeps(t) + (t.producing === null ? 0 : 1) >= params.population.cap
        );
      });
      const battles = this.battles[i]!;
      return {
        team: team.id,
        firstBornTick: this.firstBorn[i]!,
        exploredTick: this.explored[i]!,
        exploredPermille: this.seenPermille(state, team.id),
        battles: battles.size,
        battlesWithJoin: [...battles].filter((b) => this.joined.has(b)).length,
        helpJoins: null,
        capTick: capSample?.tick ?? null,
        creepsAtEnd: creeps(last.teams[i]!),
        lateMateria:
          last.teams[i]!.delivered.materia -
          lateFrom.teams[i]!.delivered.materia,
      };
    });
    return {
      multiplier: this.multiplier,
      tickSeconds,
      ticks: state.tick,
      matchSeconds: params.world.durationSeconds,
      reactionSeconds: params.encounter.reactionSeconds,
      crossingSeconds: this.crossing,
      reachableCells: this.reachableCells,
      teams,
      wanderers: {
        firstBornTick: this.firstWanderer,
        ticksAfterFirst:
          this.firstWanderer === null ? 0 : state.tick - this.firstWanderer + 1,
        ticksWithOneAlive: this.ticksWithOneAlive,
        maxAlive: this.maxAlive,
      },
      tickMicros: state.tick === 0 ? 0 : (wallSeconds * 1e6) / state.tick,
      recovery: this.recovery,
    };
  }
}

/** A target's verdict: met, missed, or not measured (null). */
export type Verdict = boolean | null;

export type TargetRow = {
  criterion: string;
  target: string;
  measured: string;
  verdict: Verdict;
};

/** World seconds as real minutes at the run's ×N. */
const realMin = (f: PaceFacts, seconds: number) => seconds / f.multiplier / 60;
const tickMin = (f: PaceFacts, tick: number) =>
  realMin(f, tick * f.tickSeconds);
const inRange = (value: number, range: { min: number; max: number }) =>
  value >= range.min && value <= range.max;
const min1 = (m: number) => `${number(m, 1)} min`;
const range = (r: { min: number; max: number }, unit = "min") =>
  `${number(r.min, Number.isInteger(r.min) ? 0 : 1)} a ${number(r.max, Number.isInteger(r.max) ? 0 : 1)} ${unit}`;
const perTeam = (values: string[]) => values.join(" · ");

/**
 * A §7 criterion: what one run measured, and how the seeds of a sweep add up
 * (by default, met on every seed).
 */
type Criterion = {
  criterion: string;
  target: string;
  run: (f: PaceFacts) => { measured: string; verdict: Verdict };
  /** The value summarized over the seeds (mean, min–max); none by default. */
  value?: (f: PaceFacts) => number | null;
  /** Over the seeds, when "every seed" is not the rule. */
  seeds?: (fs: readonly PaceFacts[]) => { measured: string; verdict: Verdict };
};

/** The real minutes of each team's moment, and whether all are in range. */
function teamMoments(
  f: PaceFacts,
  tick: (t: TeamPace) => number | null,
  window: { min: number; max: number },
) {
  const minutes = f.teams.map((t) => {
    const at = tick(t);
    return at === null ? null : tickMin(f, at);
  });
  return {
    measured: perTeam(
      minutes.map((m, i) => `time ${i}: ${m === null ? "nunca" : min1(m)}`),
    ),
    verdict: minutes.every((m) => m !== null && inRange(m, window)),
  };
}

/** The slowest team's moment in real minutes, or null if one never got there. */
function slowest(f: PaceFacts, tick: (t: TeamPace) => number | null) {
  const ticks = f.teams.map(tick);
  return ticks.some((t) => t === null)
    ? null
    : tickMin(f, Math.max(...(ticks as number[])));
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

const creepGap = (f: PaceFacts) => {
  const creeps = f.teams.map((t) => t.creepsAtEnd);
  return Math.max(...creeps) - Math.min(...creeps);
};

/** The wanderers' share of the match after the first with one alive, in %. */
const wandererAlive = (f: PaceFacts) =>
  f.wanderers.ticksAfterFirst === 0
    ? null
    : (100 * f.wanderers.ticksWithOneAlive) / f.wanderers.ticksAfterFirst;

const CRITERIA: Criterion[] = [
  {
    criterion: "Duração da partida (PA-1)",
    target: `${range(TARGETS.match)} reais`,
    run: (f) => {
      const m = realMin(f, f.matchSeconds);
      return {
        measured: `${min1(m)} (${number(f.matchSeconds)} s de mundo ÷ ${f.multiplier})`,
        verdict: inRange(m, TARGETS.match),
      };
    },
  },
  {
    criterion: "Janela da extorsão (PA-3)",
    target: `pelo menos ${TARGETS.reactionSeconds} s reais`,
    run: (f) => {
      const s = f.reactionSeconds / f.multiplier;
      return {
        measured: `${number(s, 1)} s`,
        verdict: s >= TARGETS.reactionSeconds,
      };
    },
  },
  {
    criterion: "Travessia (▲ de Núcleo a Núcleo, sem estradas)",
    target: range(TARGETS.crossing),
    value: (f) =>
      f.crossingSeconds === null ? null : realMin(f, f.crossingSeconds),
    run: (f) =>
      f.crossingSeconds === null
        ? { measured: "sem caminho", verdict: false }
        : {
            measured: min1(realMin(f, f.crossingSeconds)),
            verdict: inRange(realMin(f, f.crossingSeconds), TARGETS.crossing),
          },
  },
  {
    criterion: "Abertura: 1º creep extra de cada time",
    target: range(TARGETS.firstCreep),
    value: (f) => slowest(f, (t) => t.firstBornTick),
    run: (f) => teamMoments(f, (t) => t.firstBornTick, TARGETS.firstCreep),
  },
  {
    criterion: `Exploração: ${TARGETS.exploredPermille / 10}% do mapa alcançável visto por cada time`,
    target: range(TARGETS.explored),
    value: (f) => slowest(f, (t) => t.exploredTick),
    run: (f) => {
      const moments = teamMoments(f, (t) => t.exploredTick, TARGETS.explored);
      const end = perTeam(
        f.teams.map((t) => `${number(t.exploredPermille / 10)}%`),
      );
      return { ...moments, measured: `${moments.measured} (no fim: ${end})` };
    },
  },
  {
    criterion: "Andarilhos: o 1º nasce",
    target: range(TARGETS.firstWanderer),
    value: (f) =>
      f.wanderers.firstBornTick === null
        ? null
        : tickMin(f, f.wanderers.firstBornTick),
    run: (f) => {
      const first = f.wanderers.firstBornTick;
      return first === null
        ? { measured: "nunca", verdict: false }
        : {
            measured: min1(tickMin(f, first)),
            verdict: inRange(tickMin(f, first), TARGETS.firstWanderer),
          };
    },
  },
  {
    criterion: "Andarilhos: algum vivo depois do 1º",
    target: `em pelo menos ${TARGETS.wandererAlivePercent}% do tempo`,
    value: wandererAlive,
    run: (f) => {
      const share = wandererAlive(f);
      return share === null
        ? { measured: "nenhum nasceu", verdict: false }
        : {
            measured: `${number(share)}%`,
            verdict: share >= TARGETS.wandererAlivePercent,
          };
    },
  },
  {
    criterion: "Andarilhos vivos ao mesmo tempo",
    target: `no máximo ${TARGETS.wandererCap}`,
    value: (f) => f.wanderers.maxAlive,
    run: (f) => ({
      measured: String(f.wanderers.maxAlive),
      verdict: f.wanderers.maxAlive <= TARGETS.wandererCap,
    }),
  },
  {
    criterion: `Lutas: batalhas por time a cada ${TARGETS.battleWindow} min reais (com entrada depois da abertura)`,
    target: "no relatório",
    value: (f) =>
      f.teams.reduce(
        (sum, t) => sum + perWindow(f, t.battles, TARGETS.battleWindow),
        0,
      ) / f.teams.length,
    run: (f) => ({
      measured: perTeam(
        f.teams.map(
          (t, i) =>
            `time ${i}: ${number(perWindow(f, t.battles, TARGETS.battleWindow), 1)} (${t.battles} batalhas, ${t.battlesWithJoin} com entrada)`,
        ),
      ),
      verdict: null,
    }),
  },
  {
    criterion: `Lutas: entradas por ajuda ou "seguir", por time a cada ${TARGETS.helpJoinEvery} min reais`,
    target: "pelo menos 1",
    run: (f) =>
      f.teams.some((t) => t.helpJoins === null)
        ? { measured: "— (medido a partir da F2/F3 do slice R)", verdict: null }
        : {
            measured: perTeam(
              f.teams.map(
                (t, i) =>
                  `time ${i}: ${number(perWindow(f, t.helpJoins!, TARGETS.helpJoinEvery), 1)}`,
              ),
            ),
            verdict: f.teams.every(
              (t) => perWindow(f, t.helpJoins!, TARGETS.helpJoinEvery) >= 1,
            ),
          },
  },
  {
    criterion: `Sem bola de neve: os dois times com creeps e entregando matéria nos últimos ${TARGETS.lateDelivery} min reais`,
    target: "em todas as seeds",
    run: (f) => ({
      measured: perTeam(
        f.teams.map(
          (t, i) =>
            `time ${i}: ${t.creepsAtEnd} creeps, ${number(t.lateMateria)} matéria`,
        ),
      ),
      verdict: f.teams.every((t) => t.creepsAtEnd > 0 && t.lateMateria > 0),
    }),
  },
  {
    criterion:
      "Sem bola de neve: diferença de creeps no fim (mediana das seeds)",
    target: `no máximo ${TARGETS.creepGap}`,
    value: creepGap,
    run: (f) => ({
      measured: String(creepGap(f)),
      verdict: creepGap(f) <= TARGETS.creepGap,
    }),
    seeds: (fs) => {
      const m = median(fs.map(creepGap));
      return {
        measured: `mediana ${number(m, Number.isInteger(m) ? 0 : 1)} (${fs.map(creepGap).join(", ")})`,
        verdict: m <= TARGETS.creepGap,
      };
    },
  },
  {
    criterion: "População: creeps de cada time no fim",
    target: range(TARGETS.creepsAtEnd, "creeps"),
    run: (f) => ({
      measured: perTeam(f.teams.map((t, i) => `time ${i}: ${t.creepsAtEnd}`)),
      verdict: f.teams.every((t) =>
        inRange(t.creepsAtEnd, TARGETS.creepsAtEnd),
      ),
    }),
  },
  {
    criterion: "População: teto atingido",
    target: `não antes de ${TARGETS.capNotBefore} min`,
    run: (f) => ({
      measured: perTeam(
        f.teams.map(
          (t, i) =>
            `time ${i}: ${t.capTick === null ? "nunca" : min1(tickMin(f, t.capTick))}`,
        ),
      ),
      verdict: f.teams.every(
        (t) =>
          t.capTick === null || tickMin(f, t.capTick) >= TARGETS.capNotBefore,
      ),
    }),
  },
  {
    criterion: `Recuperação: o time do choque volta à sua contagem`,
    target: `em até ${TARGETS.recovery} min, em ${TARGETS.recoverySeedsPercent}% das seeds`,
    value: (f) => recoveryMinutes(f),
    run: (f) => {
      const r = f.recovery;
      if (r === null) return { measured: "— (sem --shock)", verdict: null };
      const minutes = recoveryMinutes(f);
      const what = `time ${r.shock.team} perdeu ${r.killed} de ${r.before} no min ${r.shock.minute}`;
      return minutes === null
        ? { measured: `${what}; não voltou`, verdict: false }
        : {
            measured: `${what}; voltou em ${min1(minutes)}`,
            verdict: minutes <= TARGETS.recovery,
          };
    },
    seeds: (fs) => {
      const shocked = fs.filter((f) => f.recovery !== null);
      if (shocked.length === 0) {
        return { measured: "— (sem --shock)", verdict: null };
      }
      const back = shocked.filter((f) => {
        const m = recoveryMinutes(f);
        return m !== null && m <= TARGETS.recovery;
      }).length;
      return {
        measured: `${back}/${shocked.length} seeds${summary(shocked.map(recoveryMinutes))}`,
        verdict: 100 * back >= TARGETS.recoverySeedsPercent * shocked.length,
      };
    },
  },
  {
    criterion: "Custo do tick (pelo host)",
    target: "até 1,5× o baseline (tasks.md, F1)",
    value: (f) => f.tickMicros,
    run: (f) => ({ measured: `${number(f.tickMicros, 1)} µs`, verdict: null }),
  },
];

/** Real minutes from the shock to the team back at its count, or null. */
function recoveryMinutes(f: PaceFacts): number | null {
  const r = f.recovery;
  return r === null || r.recoveredTick === null
    ? null
    : tickMin(f, r.recoveredTick - r.tick);
}

/** `count` per `window` real minutes, over the run. */
function perWindow(f: PaceFacts, count: number, window: number): number {
  const minutes = tickMin(f, f.ticks);
  return minutes === 0 ? 0 : (count * window) / minutes;
}

/** One run against the §7 targets. */
export function runTargets(f: PaceFacts): TargetRow[] {
  return CRITERIA.map((c) => ({
    criterion: c.criterion,
    target: c.target,
    ...c.run(f),
  }));
}

/** "mean (min–max)" of the present values, with how many never got there. */
function summary(values: (number | null)[]): string {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return "";
  const mean = present.reduce((a, b) => a + b, 0) / present.length;
  const lo = Math.min(...present);
  const hi = Math.max(...present);
  const digits = (v: number) => (Number.isInteger(v) ? 0 : 1);
  const missing = values.length - present.length;
  return (
    `; média ${number(mean, 1)} (${number(lo, digits(lo))}–${number(hi, digits(hi))})` +
    (missing > 0 ? `, ${missing}× nunca` : "")
  );
}

/** The seeds of one sweep value against the §7 targets. */
export function seedTargets(fs: readonly PaceFacts[]): TargetRow[] {
  return CRITERIA.map((c) => {
    if (c.seeds !== undefined) {
      return { criterion: c.criterion, target: c.target, ...c.seeds(fs) };
    }
    const verdicts = fs.map((f) => c.run(f).verdict);
    // Not measured and nothing to summarize: the run's own text says why.
    if (c.value === undefined && verdicts.every((v) => v === null)) {
      return { ...runTargets(fs[0]!)[CRITERIA.indexOf(c)]!, verdict: null };
    }
    const measured = verdicts.some((v) => v === null)
      ? `${fs.length} seeds`
      : `${verdicts.filter((v) => v).length}/${fs.length} seeds`;
    return {
      criterion: c.criterion,
      target: c.target,
      measured:
        measured + (c.value === undefined ? "" : summary(fs.map(c.value))),
      verdict: verdicts.some((v) => v === null)
        ? null
        : verdicts.every((v) => v),
    };
  });
}

const VERDICT_LABELS = { true: "✅", false: "❌", null: "—" } as const;

/** The targets as a Markdown table. */
export function targetsTable(rows: readonly TargetRow[]): string {
  return table(
    ["Critério", "Meta", "Medido", "Situação"],
    rows.map((r) => [
      r.criterion,
      r.target,
      r.measured,
      VERDICT_LABELS[String(r.verdict) as keyof typeof VERDICT_LABELS],
    ]),
  );
}

/**
 * report.md's section: the run's pace against the §7 targets, read at its
 * ×N. A run shorter than the match reads the targets of the end at its end.
 */
export function paceSection(f: PaceFacts): string[] {
  const short = f.ticks * f.tickSeconds < f.matchSeconds;
  return [
    "## Metas do ritmo (spec R §7)",
    "",
    `Em minutos reais a ×${f.multiplier}. ✅ cumprida, ❌ não, — sem meta ou ainda não medida. ` +
      `Mapa alcançável: ${number(f.reachableCells)} células.` +
      (short
        ? " O run é mais curto que a partida: as metas do fim leem o fim do run."
        : ""),
    "",
    targetsTable(runTargets(f)),
    "",
  ];
}
