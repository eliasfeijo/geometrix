import type {
  DynamicState,
  LoggedCommand,
  Replay,
  WelcomeMessage,
} from "@geometrix/protocol";
import {
  createWorld,
  parseParams,
  serialize,
  SIM_VERSION,
  step,
  strategistActs,
  strategistCommands,
  validate,
  view,
  type CommandInput,
  type WorldState,
} from "@geometrix/sim";
import { toDynamicState, toStaticMap } from "@geometrix/protocol";
import params from "../../../packages/sim/test/params.json" with { type: "json" };
import type { KeyValueStore } from "../src/session.ts";

/** A world built from the sim tests' fixed params. */
export function testWorld(seed = 42): WorldState {
  return createWorld(seed, parseParams(params));
}

/** The dynamic state as the server sends it, detached from `state`. */
export function dynamicOf(state: WorldState): DynamicState {
  return JSON.parse(JSON.stringify(toDynamicState(state))) as DynamicState;
}

export function welcomeOf(
  state: WorldState,
  playerId = 1,
  team = 0,
): WelcomeMessage {
  return {
    type: "welcome",
    worldId: 1,
    playerId,
    team,
    status: "running",
    multiplier: 1,
    params: state.params,
    map: toStaticMap(state),
    cores: state.teams.map((t) => t.core),
    state: dynamicOf(state),
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
 * harness logs it, with the final state's serialization (for the hash).
 */
export function botReplay(
  ticks: number,
  seed = 42,
): { replay: Omit<Replay, "finalHash">; finalJson: string } {
  const state = testWorld(seed);
  const params = state.params;
  const commands: LoggedCommand[] = [];
  while (state.tick < ticks) {
    const inputs: CommandInput[] =
      state.tick === 0
        ? [0, 1].map((team) => ({
            playerId: team + 1,
            command: { type: "join", team, bot: true },
          }))
        : strategistActs(state.tick)
          ? [0, 1].flatMap((team) =>
              strategistCommands(
                "balanced",
                view(state, team),
                state.map,
                state.params,
              ).map((command) => ({
                playerId: team + 1,
                command,
              })),
            )
          : [];
    const accepted = inputs.filter(
      ({ playerId, command }) => validate(state, command, playerId) === null,
    );
    accepted.forEach(({ playerId, command }, seq) =>
      commands.push({ tick: state.tick, seq, playerId, command }),
    );
    step(state, accepted);
  }
  return {
    replay: { simVersion: SIM_VERSION, seed, params, ticks, commands },
    finalJson: serialize(state),
  };
}
