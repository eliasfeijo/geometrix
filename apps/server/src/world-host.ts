// One hosted world (plan section 7): the state in memory, the queue of
// commands for the next tick, optional bots, and persistence of every tick.
// Commands take the same path as in the harness: validate on receipt (ack or
// reject), the accepted one gets the tick it will apply on and a seq, and step
// validates it again. Time is not read here; the TickLoop decides when a tick
// runs, so tests drive ticks directly. The events of each tick go to the
// listeners, and each team's latest ones stay in memory: the chronicle a new
// stream starts from (M2 encontro spec N-1).

import type { RejectReason, WorldStatus } from "@geometrix/protocol";
import {
  createWorld,
  findPlayer,
  restore,
  sampleMetrics,
  serialize,
  SIM_VERSION,
  step,
  strategistActs,
  strategistCommands,
  validate,
  view,
  type Command,
  eventsFor,
  type Params,
  type SimEvent,
  type TeamEvent,
  type WorldState,
} from "@geometrix/sim";
import type { ServerConfig } from "./config.ts";
import { stateHash } from "./hash.ts";
import type {
  LoggedCommand,
  Snapshot,
  Store,
  WorldRow,
} from "./persistence.ts";

export type HostContext = {
  store: Store;
  config: Pick<
    ServerConfig,
    "snapshotEveryTicks" | "metricsEveryTicks" | "chronicleWelcome"
  >;
};

export type NewWorld = {
  seed: number;
  params: Params;
  multiplier: number;
  /** Teams that get a balanced bot (spec section 5, F6 details). */
  botTeams: readonly number[];
  createdAt: string;
};

export class RecoveryError extends Error {}

type Bot = { playerId: number; team: number };

export class WorldHost {
  readonly id: number;
  readonly multiplier: number;
  readonly state: WorldState;
  status: WorldStatus;
  private readonly context: HostContext;
  private readonly bots: readonly Bot[];
  private pending: LoggedCommand[] = [];
  private readonly listeners: ((events: readonly SimEvent[]) => void)[] = [];
  /** Each team's latest events, oldest first, at most chronicleWelcome. */
  private readonly recent: TeamEvent[][];

  private constructor(
    context: HostContext,
    id: number,
    multiplier: number,
    state: WorldState,
    bots: readonly Bot[],
    status: WorldStatus,
  ) {
    this.context = context;
    this.id = id;
    this.multiplier = multiplier;
    this.state = state;
    this.bots = bots;
    this.status = status;
    this.recent = state.teams.map(() => []);
  }

  /** Creates, stores and returns a new world, with its bots joining on tick 0. */
  static create(context: HostContext, world: NewWorld): WorldHost {
    const { store } = context;
    return store.transaction(() => {
      const state = createWorld(world.seed, world.params);
      const id = store.createWorld({
        seed: world.seed,
        params: world.params,
        simVersion: SIM_VERSION,
        multiplier: world.multiplier,
        createdAt: world.createdAt,
      });
      const bots = world.botTeams.map((team) => ({
        team,
        playerId: store.addPlayer({
          worldId: id,
          team,
          name: "bot",
          tokenHash: null,
          bot: true,
        }),
      }));
      store.putSnapshot(id, snapshotOf(state));
      const host = new WorldHost(
        context,
        id,
        world.multiplier,
        state,
        bots,
        "running",
      );
      for (const bot of bots) {
        host.submit(bot.playerId, { type: "join", team: bot.team, bot: true });
      }
      return host;
    });
  }

  /**
   * Rebuilds a stored world (ADR-0004): the latest snapshot, then the logged
   * commands of the ticks after it, up to the tick the world had reached.
   * The chronicle of those ticks is deleted and written again from the
   * events step returns (M2 encontro plan section 8); each team's latest
   * entries are then read back. Players stored without a join in the state
   * (it was still queued when the process stopped) join again.
   */
  static recover(context: HostContext, row: WorldRow): WorldHost {
    const { store } = context;
    if (row.simVersion !== SIM_VERSION) {
      throw new RecoveryError(
        `world ${row.id}: sim version ${row.simVersion}, this server runs ${SIM_VERSION}`,
      );
    }
    const snapshot = store.latestSnapshot(row.id);
    if (snapshot === undefined) {
      throw new RecoveryError(`world ${row.id}: no snapshot`);
    }
    const state = restore(snapshot.stateJson);
    if (stateHash(state) !== snapshot.stateHash) {
      throw new RecoveryError(`world ${row.id}: snapshot hash mismatch`);
    }
    const log = store.commandsFrom(row.id, snapshot.tick);
    store.transaction(() => {
      store.deleteChronicleFrom(row.id, snapshot.tick);
      let at = 0;
      while (state.tick < row.tick) {
        const commands = [];
        while (at < log.length && log[at]!.tick === state.tick) {
          const { playerId, command } = log[at++]!;
          commands.push({ playerId, command });
        }
        store.putChronicle(row.id, step(state, commands));
      }
    });
    const players = store.players(row.id);
    const bots = players
      .filter((p) => p.bot)
      .map((p) => ({ playerId: p.id, team: p.team }));
    const host = new WorldHost(
      context,
      row.id,
      row.multiplier,
      state,
      bots,
      row.status,
    );
    for (const team of state.teams) {
      host.recent[team.id] = store.recentChronicle(
        row.id,
        team.id,
        context.config.chronicleWelcome,
      );
    }
    if (host.status === "running") {
      for (const p of players) {
        if (findPlayer(state, p.id) !== undefined) continue;
        host.submit(p.id, { type: "join", team: p.team, bot: p.bot });
      }
    }
    return host;
  }

  /** Ticks in the world's duration (spec M-4). */
  get durationTicks(): number {
    const { durationSeconds, tickSeconds } = this.state.params.world;
    return Math.floor(durationSeconds / tickSeconds);
  }

  /**
   * Validates `command` against the state now and queues it for the next
   * tick. Returns why it was refused, or null (accepted).
   */
  submit(playerId: number, command: Command): RejectReason | null {
    if (this.status === "ended") return "worldEnded";
    const refusal =
      validate(this.state, command, playerId) ??
      this.queuedJoinRefusal(command);
    if (refusal !== null) return refusal;
    this.pending.push({
      tick: this.state.tick,
      seq: this.pending.length,
      playerId,
      command,
    });
    return null;
  }

  /**
   * validate sees only players already in the state; joins queued for the
   * same tick count toward the human limit too.
   */
  private queuedJoinRefusal(command: Command): "teamFull" | null {
    if (command.type !== "join" || command.bot) return null;
    const humans =
      this.state.players.filter((p) => p.team === command.team && !p.bot)
        .length +
      this.pending.filter(
        (c) =>
          c.command.type === "join" &&
          !c.command.bot &&
          c.command.team === command.team,
      ).length;
    return humans >= this.state.params.teams.maxHumans ? "teamFull" : null;
  }

  /** Whether a `type` command from the player waits for the next tick. */
  queued(playerId: number, type: Command["type"]): boolean {
    return this.pending.some(
      (c) => c.playerId === playerId && c.command.type === type,
    );
  }

  /** Runs one tick: bot decisions, step, then one stored transaction. */
  tick(): void {
    if (this.status === "ended") return;
    const { state } = this;
    if (strategistActs(state.tick)) {
      for (const bot of this.bots) {
        if (findPlayer(state, bot.playerId) === undefined) continue;
        const seen = view(state, bot.team);
        for (const command of strategistCommands(
          "balanced",
          seen,
          state.map,
          state.params,
        )) {
          this.submit(bot.playerId, command);
        }
      }
    }
    const commands = this.pending;
    this.pending = [];
    const events = step(state, commands);

    const { snapshotEveryTicks, metricsEveryTicks } = this.context.config;
    const ended = state.tick >= this.durationTicks;
    const { store } = this.context;
    store.transaction(() => {
      store.commitTick({
        worldId: this.id,
        commands,
        tick: state.tick,
        snapshot:
          ended || state.tick % snapshotEveryTicks === 0
            ? snapshotOf(state)
            : undefined,
        metrics:
          state.tick % metricsEveryTicks === 0
            ? sampleMetrics(state)
            : undefined,
        events,
      });
      if (ended) store.setStatus(this.id, "ended");
    });
    if (ended) this.status = "ended";
    this.remember(events);
    for (const listener of this.listeners) listener(events);
  }

  /** The team's latest events, oldest first: what a new stream starts from. */
  chronicle(team: number): TeamEvent[] {
    return [...(this.recent[team] ?? [])];
  }

  private remember(events: readonly SimEvent[]): void {
    if (events.length === 0) return;
    const { chronicleWelcome } = this.context.config;
    for (const team of this.state.teams) {
      const seen = eventsFor(events, team.id);
      if (seen.length === 0) continue;
      const kept = [...this.recent[team.id]!, ...seen];
      this.recent[team.id] = kept.slice(
        Math.max(0, kept.length - chronicleWelcome),
      );
    }
  }

  /** Stores a snapshot of the state now (clean shutdown). */
  snapshot(): void {
    this.context.store.putSnapshot(this.id, snapshotOf(this.state));
  }

  /** Calls `listener` after every tick, with the tick's events. */
  onTick(listener: (events: readonly SimEvent[]) => void): void {
    this.listeners.push(listener);
  }
}

function snapshotOf(state: WorldState): Snapshot {
  return {
    tick: state.tick,
    stateJson: serialize(state),
    stateHash: stateHash(state),
  };
}
