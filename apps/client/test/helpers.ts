import type {
  LoggedCommand,
  Replay,
  WelcomeMessage,
} from "@geometrix/protocol";
import {
  botCommands,
  botsFor,
  createWorld,
  parseParams,
  serialize,
  SIM_VERSION,
  step,
  updateVision,
  validate,
  view,
  type Creep,
  type SimEvent,
  type TeamView,
  type WorldState,
} from "@geometrix/sim";
import { mapSize, PROTOCOL_VERSION } from "@geometrix/protocol";
import params from "../../../packages/sim/test/params.json" with { type: "json" };
import type { KeyValueStore } from "../src/session.ts";

/** A world built from the sim tests' fixed params. */
export function testWorld(seed = 42): WorldState {
  return createWorld(seed, parseParams(params));
}

/** The team's view as the client rebuilds it, detached from `state`. */
export function viewOf(state: WorldState, team = 0): TeamView {
  return JSON.parse(JSON.stringify(view(state, team))) as TeamView;
}

export function welcomeOf(
  state: WorldState,
  playerId = 1,
  team = 0,
): WelcomeMessage {
  return {
    type: "welcome",
    protocol: PROTOCOL_VERSION,
    worldId: 1,
    playerId,
    team,
    status: "running",
    multiplier: 1,
    params: state.params,
    map: mapSize(state),
    stream: "test",
    seq: 0,
    view: viewOf(state, team),
    chronicle: [],
  };
}

export function memoryStorage(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get length() {
      return data.size;
    },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

/**
 * A replay of a balanced bot on each team for `ticks` ticks, logged as the
 * harness logs it, with the final state's serialization (for the hash) and
 * every event of the run.
 */
export function botReplay(
  ticks: number,
  seed = 42,
): {
  replay: Omit<Replay, "finalHash">;
  finalJson: string;
  events: SimEvent[];
} {
  const state = testWorld(seed);
  const params = state.params;
  const commands: LoggedCommand[] = [];
  const bots = botsFor(["balanced", "balanced"]);
  const events: SimEvent[] = [];
  while (state.tick < ticks) {
    const inputs = botCommands(state, bots);
    const accepted = inputs.filter(
      ({ playerId, command }) => validate(state, command, playerId) === null,
    );
    accepted.forEach(({ playerId, command }, seq) =>
      commands.push({ tick: state.tick, seq, playerId, command }),
    );
    events.push(...step(state, accepted));
  }
  return {
    replay: { simVersion: SIM_VERSION, seed, params, ticks, commands },
    finalJson: serialize(state),
    events,
  };
}

/**
 * The seed-42 test world with an encounter just opened by the real step: a
 * circle of team 0 approaches a loaded square of team 1 standing next to it
 * by team 0's core. With `dominated`, player 9 of team 1 dominates the
 * square, so the dialogue waits for its reply (spec D6).
 */
export function encounterWorld(
  intent: "attack" | "extort",
  dominated = false,
): { world: WorldState; hunter: Creep; prey: Creep; events: SimEvent[] } {
  const world = testWorld();
  for (const creep of world.creeps) creep.rules = [];
  const hunter = world.creeps.find((c) => c.team === 0 && c.dna === "circle")!;
  const prey = world.creeps.find((c) => c.team === 1 && c.dna === "square")!;
  const core = world.teams[0]!.core;
  Object.assign(hunter, { x: core.x, y: core.y });
  Object.assign(prey, { x: core.x + 1, y: core.y });
  prey.cargo = { materia: 10, cristal: 4 };
  updateVision(world);
  if (dominated) {
    step(world, [
      { playerId: 9, command: { type: "join", team: 1, bot: false } },
    ]);
    step(world, [
      { playerId: 9, command: { type: "dominate", creepId: prey.id } },
    ]);
  }
  hunter.order = { type: "approach", targetId: prey.id, intent };
  const events: SimEvent[] = [];
  for (let i = 0; i < 5 && world.encounters.length === 0; i++) {
    events.push(...step(world, []));
  }
  if (world.encounters.length === 0) throw new Error("no encounter opened");
  return { world, hunter, prey, events };
}
