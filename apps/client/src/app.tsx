// Two screens: the lobby (list, create and join worlds) and the game. The URL
// says which (?world=3, plus ?slot=2 for another player in the same browser).

import { useEffect, useState } from "preact/hooks";
import { Game } from "./game.tsx";
import { Lobby } from "./lobby.tsx";
import {
  clearSession,
  loadSession,
  locationFor,
  parseLocation,
} from "./session.ts";

export function App() {
  const [where, setWhere] = useState(() =>
    parseLocation(window.location.search),
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const onPop = () => setWhere(parseLocation(window.location.search));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const go = (worldId: number | null) => {
    const search = locationFor(worldId, where.slot);
    window.history.pushState(null, "", search || window.location.pathname);
    setWhere({ worldId, slot: where.slot });
  };

  const session =
    where.worldId === null
      ? null
      : loadSession(window.localStorage, where.worldId, where.slot);

  if (session !== null) {
    return (
      <Game
        key={`${session.worldId}:${session.token}`}
        session={session}
        onLeave={() => go(null)}
        onInvalid={(text) => {
          clearSession(window.localStorage, session.worldId, where.slot);
          setMessage(text);
          go(null);
        }}
      />
    );
  }
  return (
    <Lobby
      slot={where.slot}
      highlight={where.worldId}
      message={message}
      onEnter={(worldId) => {
        setMessage(null);
        go(worldId);
      }}
    />
  );
}
