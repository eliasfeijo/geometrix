// The game screen: one connection to the world, the map and the panels.

import type { ClientCommand } from "@geometrix/protocol";
import { effect } from "@preact/signals";
import { useEffect, useMemo } from "preact/hooks";
import { listWorlds } from "./api.ts";
import { browserDeps, Connection, socketUrl } from "./connection.ts";
import { GameContext, type Game as GameValue } from "./context.ts";
import { FATAL_TEXTS, REJECT_TEXTS } from "./format.ts";
import type { Session } from "./session.ts";
import { CreepLayer } from "./map/creep-layer.tsx";
import { MapView } from "./map/map-view.tsx";
import { GameStore } from "./store.ts";
import { Notices, TopBar } from "./top-bar.tsx";

/** Least time between two fetches of the player names. */
const NAMES_RETRY_MS = 3000;

type Props = {
  session: Session;
  onLeave(): void;
  /** The token was refused or the world is gone: back to the lobby. */
  onInvalid(text: string): void;
};

export function Game({ session, onLeave, onInvalid }: Props) {
  const store = useMemo(() => new GameStore(), []);
  const connection = useMemo(
    () =>
      new Connection(
        socketUrl(window.location, session.token),
        {
          message: (m) => store.receive(m, performance.now()),
          status: (s) => (store.connection.value = s),
          fatal: (reason) => onInvalid(FATAL_TEXTS[reason]),
        },
        browserDeps,
      ),
    [],
  );
  useEffect(() => () => connection.close(), []);
  useEffect(() => fetchNamesWhenMissing(store, session.worldId), []);

  const game = useMemo<GameValue>(
    () => ({
      store,
      session,
      send: async (command: ClientCommand) => {
        const result = await connection.send(command);
        if (!result.ok) {
          store.notify(REJECT_TEXTS[result.reason], performance.now());
        }
        return result.ok;
      },
    }),
    [],
  );

  return (
    <GameContext.Provider value={game}>
      <div class="game">
        <TopBar onLeave={onLeave} />
        <div class="game-body">
          <MapView>
            <CreepLayer />
          </MapView>
        </div>
        <Notices />
      </div>
    </GameContext.Provider>
  );
}

/** Player names are only in the HTTP list: fetch it when a new id shows up. */
function fetchNamesWhenMissing(store: GameStore, worldId: number) {
  let lastFetch = -Infinity;
  let inFlight = false;
  return effect(() => {
    if (store.current.value === null || !store.missingNames()) return;
    const now = performance.now();
    if (inFlight || now - lastFetch < NAMES_RETRY_MS) return;
    inFlight = true;
    lastFetch = now;
    listWorlds()
      .then((worlds) => {
        const world = worlds.find((w) => w.id === worldId);
        if (world === undefined) return;
        store.names.value = new Map(world.players.map((p) => [p.id, p.name]));
      })
      .catch(() => {})
      .finally(() => (inFlight = false));
  });
}
