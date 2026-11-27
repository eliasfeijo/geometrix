// One hosted world (plan section 7): the state in memory, the queue of
// commands for the next tick, optional bots, and persistence of every tick.
// Commands take the same path as in the harness: validate on receipt (ack or
// reject), the accepted one gets the tick it will apply on and a seq, and step
// validates it again. Time is not read here; the TickLoop decides when a tick
// runs, so tests drive ticks directly. The events of each tick go to the
// listeners, and each team's latest ones stay in memory: the chronicle a new
// stream starts from (M2 encontro spec N-1). The world steps through the
// junction host (junction plan P5, section 7): its battles' results enter
// the tick's log after the players' commands, as the system player's.

import {
  BATTLE_VERSION,
  battleView,
  type BattleEvent,
  type BattleParams,
} from "@geometrix/battle";
import {
  addInstances,
  createHost,
  humanControls,
  instanceRecord,
  participantOf,
  rebuildInstance,
  setHold,
  stepJunction,
  stepRealtime,
  type Instance,
  type JunctionHost,
} from "@geometrix/junction";
import {
  diffBattleView,
  emptyBattleSent,
  type BattleFrameMessage,
  type BattleInputCommand,
  type BattleOpenMessage,
  type BattleRoster,
  type BattleSent,
  type RejectReason,
  type WorldStatus,
} from "@geometrix/protocol";
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
  threatPass,
  validate,
  view,
  type Command,
  type Difficulty,
  eventsFor,
  type Params,
  type SimEvent,
  type TeamEvent,
  type WorldState,
} from "@geometrix/sim";
import type { ServerConfig } from "./config.ts";
import { battleHash, stateHash } from "./hash.ts";
import type {
  BattlesRecord,
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
  /** Kept with the world, like `params` (junction F4). */
  battleParams: BattleParams;
  multiplier: number;
  /** Teams that get a balanced bot (spec section 5, F6 details). */
  botTeams: readonly number[];
  /** A bot team's difficulty, by team id (R spec D26); hard if left out. */
  botDifficulty?: Readonly<Record<number, Difficulty>>;
  createdAt: string;
};

export class RecoveryError extends Error {}

type Bot = { playerId: number; team: number };

/** Who shows a battle screen: a player of a team with a side in it. */
type Screen = { playerId: number; team: number; battleId: number };

export class WorldHost {
  readonly id: number;
  readonly multiplier: number;
  readonly state: WorldState;
  /** The battle instances next to the world (ADR-0010). */
  readonly junction: JunctionHost;
  status: WorldStatus;
  private readonly context: HostContext;
  private readonly bots: readonly Bot[];
  private pending: LoggedCommand[] = [];
  private readonly listeners: ((events: readonly SimEvent[]) => void)[] = [];
  /** Each team's latest events, oldest first, at most chronicleWelcome. */
  private readonly recent: TeamEvent[][];
  /** Per stored battle, how many of its log's ticks are in the store. */
  private readonly storedTicks = new Map<number, number>();
  /** Battles that ended since the last commit, outside a world tick. */
  private ended: Instance[] = [];
  /**
   * The battle screens open, by viewer (a socket): frames go to them (N-2),
   * and a dominating player's screen sets the pace (D13).
   */
  private readonly screens = new Map<object, Screen>();
  /**
   * Per watched battle, the view its screens last received: the frames are
   * its deltas (P9, F4).
   */
  private readonly battleSent = new Map<number, BattleSent>();
  /** Battle inputs for the next real-time battle tick, by battle (C-2). */
  private inputs = new Map<number, BattleInputCommand[]>();
  private readonly frameListeners: ((frame: BattleFrameMessage) => void)[] = [];
  private readonly screenListeners: (() => void)[] = [];

  private constructor(
    context: HostContext,
    id: number,
    multiplier: number,
    state: WorldState,
    junction: JunctionHost,
    bots: readonly Bot[],
    status: WorldStatus,
  ) {
    this.context = context;
    this.id = id;
    this.multiplier = multiplier;
    this.state = state;
    this.junction = junction;
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
        battleParams: world.battleParams,
        simVersion: SIM_VERSION,
        multiplier: world.multiplier,
        createdAt: world.createdAt,
      });
      const bots = world.botTeams.map((team) => {
        const difficulty = world.botDifficulty?.[team] ?? "hard";
        const playerId = store.addPlayer({
          worldId: id,
          team,
          name: "bot",
          tokenHash: null,
          bot: true,
          difficulty,
        });
        return { team, playerId, difficulty };
      });
      store.putSnapshot(id, snapshotOf(state));
      const host = new WorldHost(
        context,
        id,
        world.multiplier,
        state,
        createHost(world.battleParams),
        bots,
        "running",
      );
      for (const { playerId, team, difficulty } of bots) {
        host.submit(playerId, { type: "join", team, bot: true, difficulty });
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
  static recover(
    context: HostContext,
    row: WorldRow,
    serverBattleParams: BattleParams,
  ): WorldHost {
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
    const junction = createHost(row.battleParams ?? serverBattleParams);
    const storedTicks = new Map<number, number>();
    // An ended world restores without them: nothing would step them (E-min
    // plan P8).
    const open = state.result === null ? state.battles : [];
    const instances = open.map((stub) => {
      const battle = store.battle(row.id, stub.id);
      if (battle === undefined) {
        throw new RecoveryError(
          `world ${row.id}: battle ${stub.id} not stored`,
        );
      }
      if (battle.battleVersion !== BATTLE_VERSION) {
        throw new RecoveryError(
          `world ${row.id}: battle ${stub.id} from battle version ${battle.battleVersion}, this server runs ${BATTLE_VERSION}`,
        );
      }
      const ticks = store.battleTicks(row.id, stub.id);
      storedTicks.set(stub.id, ticks.length);
      return rebuildInstance(battle.record, {
        battleVersion: battle.battleVersion,
        setup: battle.setup,
        params: battle.params,
        ticks: battle.reachedTick,
        commands: ticks,
        finalHash: null,
      });
    });
    addInstances(junction, instances);
    const players = store.players(row.id);
    const bots = players
      .filter((p) => p.bot)
      .map((p) => ({ playerId: p.id, team: p.team }));
    const host = new WorldHost(
      context,
      row.id,
      row.multiplier,
      state,
      junction,
      bots,
      row.status,
    );
    for (const [id, count] of storedTicks) host.storedTicks.set(id, count);
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
        host.submit(p.id, {
          type: "join",
          team: p.team,
          bot: p.bot,
          ...(p.difficulty === null ? {} : { difficulty: p.difficulty }),
        });
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

  /**
   * Runs one tick: bot decisions, the step through the junction host, then
   * one stored transaction with the players' commands and the battles'
   * results (ADR-0010 rule 5).
   */
  tick(): void {
    if (this.status === "ended") return;
    const { state } = this;
    // The full decision once a minute; between them, the hard bots' threat
    // pass on every tick (R spec D27, plan P9), as the harness runs them.
    const acts = strategistActs(state.tick);
    for (const bot of this.bots) {
      if (findPlayer(state, bot.playerId) === undefined) continue;
      // A team out sends nothing (E-min B-2), so it is not asked.
      if (state.teams[bot.team]!.out !== null) continue;
      const commands = acts
        ? strategistCommands(
            "balanced",
            view(state, bot.team),
            state.map,
            state.params,
          )
        : threatPass(state, bot.team);
      for (const command of commands) this.submit(bot.playerId, command);
    }
    const players = this.pending;
    this.pending = [];
    const tick = state.tick;
    const before = [...this.junction.instances];
    this.syncScreens();
    const done = stepJunction(state, this.junction, players);
    const commands: LoggedCommand[] = [
      ...players,
      ...done.results.map(({ playerId, command }, i) => ({
        tick,
        seq: players.length + i,
        playerId,
        command,
      })),
    ];
    const { events } = done;

    const { snapshotEveryTicks, metricsEveryTicks } = this.context.config;
    // The sim ends the world: elimination, a concession or the clock (E-min
    // plan P1). An ended world is frozen and steps no more.
    const ended = state.result !== null;
    const { store } = this.context;
    const gone = [
      ...this.ended,
      ...before.filter((i) => !this.junction.instances.includes(i)),
    ];
    const battles = this.battlesRecord(tick, gone);
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
        battles,
      });
      if (ended) store.setStatus(this.id, "ended");
    });
    for (const instance of this.junction.instances) {
      this.storedTicks.set(instance.battleId, instance.log.commands.length);
    }
    for (const instance of gone) this.storedTicks.delete(instance.battleId);
    this.ended = [];
    if (ended) this.status = "ended";
    this.remember(events);
    for (const listener of this.listeners) listener(events);
    // Inputs wait only for a battle on the real pace (or about to be), or
    // held.
    for (const id of [...this.inputs.keys()]) {
      const instance = this.instance(id);
      if (instance === undefined || instance.pace === "world") {
        this.inputs.delete(id);
      }
    }
    for (const { battleId, events: battleEvents } of done.stepped) {
      const instance = before.find((i) => i.battleId === battleId)!;
      this.frame(instance, battleEvents);
    }
  }

  /**
   * One real-time battle tick (T-2) of each battle on the real pace, with the
   * inputs that arrived since the last; the battle clock calls it every 50 ms.
   * The results wait for the next world tick (P5).
   */
  realtimeTick(): void {
    if (this.status === "ended") return;
    for (const instance of [...this.junction.instances]) {
      if (instance.pace !== "real") continue;
      const inputs = this.inputs.get(instance.battleId) ?? [];
      this.inputs.delete(instance.battleId);
      const { events, finished } = stepRealtime(
        this.state,
        this.junction,
        instance.battleId,
        inputs,
      );
      if (finished.length > 0) this.ended.push(instance);
      this.frame(instance, events);
    }
  }

  private instance(battleId: number): Instance | undefined {
    return this.junction.instances.find((i) => i.battleId === battleId);
  }

  /**
   * Opens `viewer`'s battle screen (N-2): a player of a team with a side in
   * the battle. Replaces the screen it had. Returns what the screen gets
   * once (P9), or why it cannot open.
   */
  openScreen(
    viewer: object,
    player: { id: number; team: number },
    battleId: number,
  ): BattleOpenMessage | RejectReason {
    const stub = this.state.battles.find((b) => b.id === battleId);
    const instance = this.instance(battleId);
    if (stub === undefined || instance === undefined) return "unknownBattle";
    const side = stub.sides.some(
      (s) => s.kind === "team" && s.team === player.team,
    );
    if (!side) return "notYourBattle";
    this.screens.set(viewer, {
      playerId: player.id,
      team: player.team,
      battleId,
    });
    this.screensChanged();
    return this.opening(instance);
  }

  /** Back to the map, or the viewer left. */
  closeScreen(viewer: object): void {
    if (this.screens.delete(viewer)) this.screensChanged();
  }

  /** Calls `listener` when a viewer opens or closes a battle screen. */
  onScreens(listener: () => void): void {
    this.screenListeners.push(listener);
  }

  private screensChanged(): void {
    this.syncScreens();
    for (const listener of this.screenListeners) listener();
  }

  /**
   * The teams with a side in a battle going on, by id; null once it ended
   * (or there is none).
   */
  battleTeams(battleId: number): number[] | null {
    const stub = this.state.battles.find((b) => b.id === battleId);
    if (stub === undefined || this.instance(battleId) === undefined) {
      return null;
    }
    return stub.sides
      .flatMap((side) => (side.kind === "team" ? [side.team] : []))
      .sort((a, b) => a - b);
  }

  /**
   * Whether the player controls a participant of the battle: the creep it
   * dominates is in the arena and it shows the battle's screen (D13, D28).
   */
  controls(playerId: number, battleId: number): boolean {
    const instance = this.instance(battleId);
    const creep = this.state.creeps.find((c) => c.dominatedBy === playerId);
    if (instance === undefined || creep === undefined) return false;
    this.syncScreens();
    return (
      creep.battle === battleId &&
      participantOf(instance, creep.id) !== null &&
      this.junction.screens.includes(creep.id)
    );
  }

  /** Whether some human controls a participant of the battle (BP-4). */
  humanControlled(battleId: number): boolean {
    this.syncScreens();
    return humanControls(this.state, this.junction, battleId);
  }

  /**
   * Holds a battle or releases it (R plan P11): while held it advances on
   * neither clock. The holds are the server's (holds.ts), never stored.
   */
  setHold(battleId: number, held: boolean): void {
    this.syncScreens();
    setHold(this.state, this.junction, battleId, held);
  }

  /** The battle `viewer` shows, or null. */
  screenOf(viewer: object): number | null {
    return this.screens.get(viewer)?.battleId ?? null;
  }

  /**
   * The creeps whose dominating player shows their battle (D13): the host's
   * screens, which set the pace and the controller from the next tick.
   */
  private syncScreens(): void {
    const open = [...this.screens.values()];
    this.junction.screens = this.state.creeps
      .filter(
        (c) =>
          c.battle !== null &&
          c.dominatedBy !== null &&
          open.some(
            (s) => s.playerId === c.dominatedBy && s.battleId === c.battle,
          ),
      )
      .map((c) => c.id)
      .sort((a, b) => a - b);
  }

  /**
   * Queues a battle command of `playerId` for its battle's next real-time
   * tick (C-2): only for the participant of the creep it dominates. On the
   * world clock, the inputs are dropped at the next world tick. While the
   * battle is held, only each participant's latest intent waits for the
   * resume (a key released in the pause must not stay down); the one-shot
   * commands are dropped.
   */
  battleInput(
    playerId: number,
    battleId: number,
    command: BattleInputCommand,
  ): RejectReason | null {
    if (this.status === "ended") return "worldEnded";
    const instance = this.instance(battleId);
    if (instance === undefined) return "unknownBattle";
    const creep = this.state.creeps.find((c) => c.dominatedBy === playerId);
    if (creep === undefined || creep.battle !== battleId) {
      return "notYourParticipant";
    }
    if (participantOf(instance, creep.id) !== command.id) {
      return "notYourParticipant";
    }
    let queued = this.inputs.get(battleId) ?? [];
    if (instance.pace === "held") {
      if (command.type !== "intent") return null;
      queued = queued.filter((c) => c.type !== "intent" || c.id !== command.id);
    }
    queued.push(command);
    this.inputs.set(battleId, queued);
    return null;
  }

  /** Who is who in a battle; null once the world closed it. */
  private roster(instance: Instance): BattleRoster | null {
    const stub = this.state.battles.find((b) => b.id === instance.battleId);
    if (stub === undefined) return null;
    return {
      members: instance.members.map((m) => ({ ...m })),
      sides: instance.sideOf.map((side) => ({ ...stub.sides[side]! })),
    };
  }

  /**
   * What a screen gets once when it opens (P9), with the view now, which the
   * battle's next frame is a delta of. Brings the battle's base up to now: a
   * no-op while another screen shows it (each step sent it a frame).
   */
  private opening(instance: Instance): BattleOpenMessage {
    const { battleId } = instance;
    let sent = this.battleSent.get(battleId);
    if (sent === undefined) {
      sent = emptyBattleSent();
      this.battleSent.set(battleId, sent);
    }
    const view = battleView(instance.state);
    diffBattleView(sent, view);
    return {
      type: "battleOpen",
      battleId,
      arena: instance.state.arena,
      params: instance.state.params,
      roster: this.roster(instance)!,
      view,
    };
  }

  /**
   * Hands the listeners a frame of `instance` when a screen shows it; after
   * the last frame (the battle ended), its screens close.
   */
  private frame(instance: Instance, events: BattleEvent[]): void {
    const { battleId } = instance;
    const watched = [...this.screens.values()].some(
      (s) => s.battleId === battleId,
    );
    const sent = this.battleSent.get(battleId);
    if (watched && sent !== undefined) {
      const roster = events.some((e) => e.type === "joined")
        ? this.roster(instance)
        : null;
      const frame: BattleFrameMessage = {
        type: "battleFrame",
        battleId,
        delta: diffBattleView(sent, battleView(instance.state)),
        events,
        ...(roster === null ? {} : { roster }),
      };
      for (const listener of this.frameListeners) listener(frame);
    }
    if (!watched || instance.state.ended !== null) {
      this.battleSent.delete(battleId);
    }
    if (instance.state.ended !== null) {
      for (const [viewer, screen] of this.screens) {
        if (screen.battleId === battleId) this.screens.delete(viewer);
      }
      this.syncScreens();
    }
  }

  /** Calls `listener` with each battle frame some screen shows. */
  onBattleFrame(listener: (frame: BattleFrameMessage) => void): void {
    this.frameListeners.push(listener);
  }

  /**
   * What the tick's transaction writes about the battles (junction plan
   * section 6): the ones opened, the battle ticks with commands run since
   * the last commit, the tick each one reached, and the ends (`gone`, which
   * left the host; the world applied their end on `tick`).
   */
  private battlesRecord(
    tick: number,
    gone: readonly Instance[],
  ): BattlesRecord {
    const record: BattlesRecord = {
      opened: [],
      ticks: [],
      reached: [],
      ended: [],
    };
    for (const instance of [...this.junction.instances, ...gone]) {
      const { battleId, log } = instance;
      const stored = this.storedTicks.get(battleId);
      if (stored === undefined) {
        record.opened.push({
          battleId,
          openedTick: tick,
          battleVersion: log.battleVersion,
          setup: log.setup,
          params: log.params,
        });
      }
      for (const entry of log.commands.slice(stored ?? 0)) {
        record.ticks.push({ battleId, tick: entry });
      }
      record.reached.push({
        battleId,
        reachedTick: log.ticks,
        record: instanceRecord(instance),
      });
    }
    for (const instance of gone) {
      record.ended.push({
        battleId: instance.battleId,
        endedTick: tick,
        finalHash: battleHash(instance.state),
      });
    }
    return record;
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
