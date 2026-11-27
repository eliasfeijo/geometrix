// npm run soak (spec section 8 item 3, plan section 8 F9 details): the parts
// that do not touch processes or the network, so the tests can check them.
// The script itself is soak-main.ts.

import { parseArgs } from "node:util";
import { replayLog, type BattleLog, type LoggedTick } from "@geometrix/battle";
import { replayResults } from "@geometrix/junction";
import type { LoggedCommand, Replay, WorldSummary } from "@geometrix/protocol";
import {
  canonicalJson,
  createWorld,
  endSummary,
  step,
  type Command,
  type CommandInput,
  type EndSummary,
  type SimEvent,
  type WorldState,
} from "@geometrix/sim";
import { battleHash } from "./hash.ts";
import type { BattleRow } from "./persistence.ts";

export const SOAK_USAGE = `usage: npm run soak -- [options]

Runs a whole bot x bot world through the real server loop, kills the server
(kill -9) at random ticks, each at the first battle open after its tick, and
restarts it, stops it once cleanly (SIGTERM), and at the end rebuilds the
exported replay in Node: its hash must match the server's. Each ended battle's
stored log must replay to its final hash and to the results the world log
applied, and the battles a kill cut through must have ended (M2 junction).
The world may end before its clock; the lobby's result and each
client's summary must match the replay's, the report says when and how it
ended, and an interruption the end came before is reported, not failed
(M2 minimal end).
Headless clients follow their team streams the whole time, dropping their own
connection now and then; each must end with the server's view and no hash
mismatch (M1.5), and with the server's chronicle (M2). Samples memory,
database size and loop speed into runs/soak-<id>/.

  --mult <n>      time multiplier (default 360: the 2-hour world in ~3 min)
  --kills <n>     kill -9 + restart count (default 5)
  --seed <n>      world seed and kill schedule seed (default 42)
  --port <n>      server port (default 8089)
  --clients <n>   headless clients per team, 0..3 (default 2)
  --drop-every <s>  real seconds between a client's own drops (default 60)
  --db <file>     SQLite file (default: a new one in the OS temp dir)
  --out <dir>     runs directory (default runs)
`;

export type SoakOptions = {
  multiplier: number;
  kills: number;
  seed: number;
  port: number;
  /** Headless clients per team (teams.maxHumans is 3). */
  clients: number;
  /** Real seconds between a client's own drops (short drops, spec S-5). */
  dropEverySeconds: number;
  db: string | undefined;
  out: string;
};

export class SoakError extends Error {}

function integer(name: string, raw: string, min: number, max: number): number {
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new SoakError(`--${name} must be an integer in ${min}..${max}`);
  }
  return value;
}

export function parseSoakArgs(args: readonly string[]): SoakOptions {
  let values;
  try {
    ({ values } = parseArgs({
      args: [...args],
      options: {
        mult: { type: "string" },
        kills: { type: "string" },
        seed: { type: "string" },
        port: { type: "string" },
        clients: { type: "string" },
        "drop-every": { type: "string" },
        db: { type: "string" },
        out: { type: "string" },
      },
      strict: true,
    }));
  } catch (error) {
    throw new SoakError((error as Error).message);
  }
  return {
    multiplier:
      values.mult === undefined ? 360 : integer("mult", values.mult, 1, 10_000),
    kills:
      values.kills === undefined ? 5 : integer("kills", values.kills, 0, 100),
    seed:
      values.seed === undefined
        ? 42
        : integer("seed", values.seed, 0, 2 ** 32 - 1),
    port:
      values.port === undefined
        ? 8089
        : integer("port", values.port, 1, 65_535),
    clients:
      values.clients === undefined
        ? 2
        : integer("clients", values.clients, 0, 3),
    dropEverySeconds:
      values["drop-every"] === undefined
        ? 60
        : integer("drop-every", values["drop-every"], 5, 3600),
    db: values.db,
    out: values.out ?? "runs",
  };
}

/** What happens to the server at a tick: a crash or a clean stop. */
export type Interruption = { tick: number; kind: "kill" | "term" };

/**
 * `kills` crashes at distinct ticks drawn from `seed`, plus one clean stop,
 * all between 5% and 95% of the world, sorted. The draw is a small LCG so a
 * seed always gives the same schedule.
 */
export function interruptions(
  seed: number,
  kills: number,
  durationTicks: number,
): Interruption[] {
  const low = Math.floor(durationTicks * 0.05);
  const span = Math.floor(durationTicks * 0.9);
  let x = seed >>> 0;
  const next = () => {
    x = (Math.imul(x, 1_664_525) + 1_013_904_223) >>> 0;
    return x;
  };
  const ticks = new Set<number>();
  while (ticks.size < Math.min(kills + 1, span)) {
    ticks.add(low + (next() % span));
  }
  const sorted = [...ticks].sort((a, b) => a - b);
  // The clean stop takes the middle slot, crashes around it.
  const term = Math.floor(sorted.length / 2);
  return sorted.map((tick, i) => ({
    tick,
    kind: i === term ? "term" : "kill",
  }));
}

/**
 * The state a replay ends on, rebuilt with the sim (as the browser does).
 * `onEvents` gets each tick's events.
 */
export function rebuild(
  replay: Replay,
  onEvents?: (events: readonly SimEvent[]) => void,
): WorldState {
  const state = createWorld(replay.seed, replay.params);
  let at = 0;
  while (state.tick < replay.ticks) {
    const commands: CommandInput[] = [];
    while (replay.commands[at]?.tick === state.tick) {
      const { playerId, command } = replay.commands[at++]!;
      commands.push({ playerId, command });
    }
    const events = step(state, commands);
    onEvents?.(events);
  }
  return state;
}

/** What the battle tables hold at the end, checked against the world log. */
export type BattleCheck = {
  battles: number;
  ended: number;
  /**
   * Still open when the world ended (stopped by it, E-min X-1): replayed to
   * their last stored tick, their sent commands checked.
   */
  open: number[];
  /** Ended battles whose stored log replays to another final hash. */
  hashMismatches: number[];
  /**
   * Ended battles whose results disagree with the world log: the record's
   * sent commands, or the results its log replays to (ADR-0010 rule 4).
   */
  resultMismatches: number[];
  /**
   * Ended with joins still waiting: their exits carry the world's creep as it
   * was then, which the tables do not keep, so only the hash and the sent
   * commands are checked.
   */
  lateJoins: number[];
};

/**
 * The two logs agree after the crashes (junction spec section 7): each ended
 * battle's stored log replays to its stored final hash, and the world log
 * applied exactly the results the battle sent and its log replays to.
 * `world` lends the map and the params (any tick of the run).
 */
export function checkBattles(
  world: WorldState,
  rows: readonly BattleRow[],
  ticksOf: (battleId: number) => LoggedTick[],
  log: readonly LoggedCommand[],
): BattleCheck {
  const applied = new Map<number, Command[]>();
  for (const { command } of log) {
    if (command.type !== "battleExit" && command.type !== "battleEnd") {
      continue;
    }
    const list = applied.get(command.battleId) ?? [];
    list.push(command);
    applied.set(command.battleId, list);
  }
  const check: BattleCheck = {
    battles: rows.length,
    ended: 0,
    open: [],
    hashMismatches: [],
    resultMismatches: [],
    lateJoins: [],
  };
  // Key order differs between the tables and an exported replay.
  const same = (a: unknown, b: unknown) =>
    canonicalJson(a) === canonicalJson(b);
  for (const row of rows) {
    const battleLog: BattleLog = {
      battleVersion: row.battleVersion,
      setup: row.setup,
      params: row.params,
      ticks: row.reachedTick,
      commands: ticksOf(row.battleId),
      finalHash: null,
    };
    const worldSide = applied.get(row.battleId) ?? [];
    if (row.endedTick === null) {
      // No final hash to compare: the log must replay (it throws if not).
      check.open.push(row.battleId);
      replayLog(battleLog);
      if (!same(row.record.sent, worldSide)) {
        check.resultMismatches.push(row.battleId);
      }
      continue;
    }
    check.ended += 1;
    if (battleHash(replayLog(battleLog)) !== row.finalHash) {
      check.hashMismatches.push(row.battleId);
    }
    let agree = same(row.record.sent, worldSide);
    if (row.record.pending.length > 0) {
      check.lateJoins.push(row.battleId);
    } else {
      const replayed = replayResults(world, {
        ...row.record,
        log: battleLog,
        late: [],
        results: row.record.sent,
      });
      agree &&= same(replayed, worldSide);
    }
    if (!agree) check.resultMismatches.push(row.battleId);
  }
  return check;
}

/** The end the server shows against the one the replay reaches. */
export type EndCheck = {
  /** The rebuilt replay's summary; null: the replay never reaches an end. */
  end: EndSummary | null;
  /** The lobby lists the replay's result. */
  lobbyOk: boolean;
  /** Every client's summary is the replay's. */
  clientsOk: boolean;
  ok: boolean;
};

/**
 * `listed` is the lobby's result and `seen` each client's last summary, both
 * as the server sent them; `final` is the state the exported replay reaches.
 */
export function checkEnd(
  final: WorldState,
  listed: WorldSummary["result"],
  seen: readonly (EndSummary | null)[],
): EndCheck {
  const end = endSummary(final);
  const lobbyOk =
    end !== null &&
    canonicalJson(listed) ===
      canonicalJson({
        how: end.result.how,
        winner: end.result.winner,
        teams: end.result.teams,
      });
  const clientsOk =
    end !== null &&
    seen.every((s) => s !== null && canonicalJson(s) === canonicalJson(end));
  return { end, lobbyOk, clientsOk, ok: lobbyOk && clientsOk };
}

/**
 * When and how the world ended, in one sentence. Real minutes are at the
 * params' ×N (`multiplier`), not the soak's own.
 */
export function describeEnd(end: EndSummary, multiplier: number): string {
  const { result } = end;
  const worldMinutes = Math.floor(end.durationSeconds / 60);
  const how =
    result.how === "clock"
      ? "the clock ran out"
      : end.teams
          .flatMap(({ team, out }) =>
            out === null
              ? []
              : [
                  `team ${team} ${
                    out.how === "eliminated"
                      ? "was eliminated"
                      : out.bot
                        ? "conceded (its bot)"
                        : "conceded"
                  } at tick ${out.tick}`,
                ],
          )
          .join(", ");
  const outcome =
    result.winner !== null
      ? `team ${result.winner} won`
      : `a draw between teams ${result.teams.join(" and ")}`;
  return (
    `tick ${result.tick} (world ${Math.floor(worldMinutes / 60)} h ` +
    `${worldMinutes % 60} min, ${(end.durationSeconds / multiplier / 60).toFixed(1)} ` +
    `real min at ×${multiplier}): ${how}; ${outcome}`
  );
}

/** One reading taken while the world runs. */
export type SoakSample = {
  /** Real seconds since the soak started. */
  seconds: number;
  /** Server process (changes with every restart). */
  pid: number;
  tick: number;
  /** Resident memory of the server process, in MB (null off Linux). */
  rssMb: number | null;
  /** SQLite file plus its WAL, in MB. */
  dbMb: number;
  /** World ticks per real second since the previous sample, same process. */
  ticksPerSecond: number | null;
};

export type SoakSummary = {
  samples: number;
  maxRssMb: number | null;
  /** Memory of each process at its last sample: growth shows a leak. */
  rssByProcess: {
    pid: number;
    firstMb: number | null;
    lastMb: number | null;
  }[];
  finalDbMb: number;
  /** Slowest loop speed seen, as a share of the multiplier. */
  minSpeedShare: number | null;
  medianSpeedShare: number | null;
};

export function summarize(
  samples: readonly SoakSample[],
  multiplier: number,
): SoakSummary {
  const rss = samples
    .map((s) => s.rssMb)
    .filter((v): v is number => v !== null);
  const shares = samples
    .map((s) => s.ticksPerSecond)
    .filter((v): v is number => v !== null)
    .map((v) => v / multiplier)
    .sort((a, b) => a - b);
  const pids = [...new Set(samples.map((s) => s.pid))];
  return {
    samples: samples.length,
    maxRssMb: rss.length === 0 ? null : Math.max(...rss),
    rssByProcess: pids.map((pid) => {
      const own = samples.filter((s) => s.pid === pid);
      return {
        pid,
        firstMb: own[0]!.rssMb,
        lastMb: own[own.length - 1]!.rssMb,
      };
    }),
    finalDbMb: samples.length === 0 ? 0 : samples[samples.length - 1]!.dbMb,
    minSpeedShare: shares.length === 0 ? null : shares[0]!,
    medianSpeedShare:
      shares.length === 0 ? null : shares[Math.floor(shares.length / 2)]!,
  };
}

export function samplesCsv(samples: readonly SoakSample[]): string {
  const header = "seconds,pid,tick,rssMb,dbMb,ticksPerSecond\n";
  return (
    header +
    samples
      .map((s) =>
        [
          s.seconds.toFixed(1),
          s.pid,
          s.tick,
          s.rssMb?.toFixed(1) ?? "",
          s.dbMb.toFixed(2),
          s.ticksPerSecond?.toFixed(1) ?? "",
        ].join(","),
      )
      .map((line) => `${line}\n`)
      .join("")
  );
}
