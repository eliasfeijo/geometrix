// The live game screen: one connection to the world, the map and the panels.

import type { ClientCommand } from "@geometrix/protocol";
import { effect } from "@preact/signals";
import { useEffect, useMemo } from "preact/hooks";
import { listWorlds } from "./api.ts";
import { BattleControl } from "./battle-control.ts";
import { browserDeps, Connection, socketUrl } from "./connection.ts";
import type { Game as GameValue } from "./context.ts";
import { FATAL_TEXTS, REJECT_TEXTS } from "./format.ts";
import { GameLayout } from "./game-layout.tsx";
import { NetPanel, showNetPanel } from "./net-panel.tsx";
import type { Session } from "./session.ts";
import { GameStore } from "./store.ts";
import { TopBar } from "./top-bar.tsx";

/** Least time between two fetches of the player names. */
const NAMES_RETRY_MS = 3000;

/** Time to read the notice before a reload for a new protocol version. */
const RELOAD_MS = 1500;

type Props = {
  session: Session;
  onLeave(): void;
  /** The token was refused or the world is gone: back to the lobby. */
  onInvalid(text: string): void;
};

export function Game({ session, onLeave, onInvalid }: Props) {
  const store = useMemo(() => new GameStore(), []);
  // The connection is made after it, so its messages find it.
  const battles = useMemo<{ control: BattleControl | null }>(
    () => ({ control: null }),
    [],
  );
  const connection = useMemo(
    () =>
      new Connection(
        socketUrl(window.location, session.token),
        {
          message: (m) => store.receive(m, performance.now()),
          battle: (m) => battles.control?.receive(m, performance.now()),
          status: (s) => {
            const was = store.connection.value;
            store.connection.value = s;
            if (s === "reconnecting") battles.control?.dropped();
            if (s === "open" && was === "reconnecting") {
              battles.control?.reconnected();
            }
          },
          fatal: (reason) => {
            if (reason !== "outdated") return onInvalid(FATAL_TEXTS[reason]);
            // Spec C-5: a tab older than the server reloads.
            store.notify(FATAL_TEXTS.outdated, performance.now());
            window.setTimeout(() => window.location.reload(), RELOAD_MS);
          },
          resync: (reason, seq) =>
            console.warn(`resync reason=${reason} seq=${seq}`),
        },
        browserDeps,
        store.net,
      ),
    [],
  );
  const control = useMemo(() => {
    const made = new BattleControl(store, connection, () => performance.now());
    battles.control = made;
    return made;
  }, []);
  useEffect(() => {
    store.hashMismatch = () => connection.resync("hashMismatch");
  }, []);
  // N-1: the dominated creep's battle opens its screen by itself.
  useEffect(
    () =>
      effect(() => {
        const mine = store.myCreep.value;
        control.follow(mine === null ? null : mine);
      }),
    [],
  );
  useEffect(() => () => connection.close(), []);
  useEffect(() => fetchNamesWhenMissing(store, session.worldId), []);

  const game = useMemo<GameValue>(
    () => ({
      store,
      viewer: { playerId: session.playerId, team: session.team },
      send: async (command: ClientCommand) => {
        const result = await connection.send(command);
        if (!result.ok) {
          store.notify(REJECT_TEXTS[result.reason], performance.now());
        }
        return result.ok;
      },
      battles: control,
    }),
    [],
  );

  return (
    <>
      <GameLayout
        game={game}
        header={<TopBar session={session} onLeave={onLeave} />}
        orders
      />
      {showNetPanel(window.location) && (
        <NetPanel
          stats={store.net}
          motion={store.motion}
          battleRttMs={() => control.rttMs}
        />
      )}
    </>
  );
}

/** Player names are only in the HTTP list: fetch it when a new id shows up. */
export function fetchNamesWhenMissing(store: GameStore, worldId: number) {
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
