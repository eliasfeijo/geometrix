// Three screens: the lobby (list, create and join worlds), the game and the
// replay. The URL says which (?world=3, plus ?slot=2 for another player in the
// same browser; ?replay=3 for a server world's replay). A replay file opened
// from the lobby lives only in memory.

import { useEffect, useState } from "preact/hooks";
import { Game } from "./game.tsx";
import { Lobby } from "./lobby.tsx";
import { LazyReplayScreen, type ReplaySource } from "./replay/lazy.tsx";
import {
  clearSession,
  loadSession,
  locationFor,
  parseLocation,
  replayWorldOf,
} from "./session.ts";

type Where = ReturnType<typeof parseLocation> & { replay: number | null };

function here(): Where {
  const search = window.location.search;
  return { ...parseLocation(search), replay: replayWorldOf(search) };
}

export function App() {
  const [where, setWhere] = useState(here);
  const [file, setFile] = useState<ReplaySource | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const onPop = () => {
      setFile(null);
      setWhere(here());
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = (search: string) => {
    window.history.pushState(null, "", search || window.location.pathname);
    setWhere(here());
  };
  const go = (worldId: number | null) =>
    navigate(locationFor(worldId, where.slot));
  const watch = (worldId: number) => {
    const params = new URLSearchParams(locationFor(null, where.slot));
    params.set("replay", String(worldId));
    navigate(`?${params.toString()}`);
  };
  const leaveReplay = () => {
    setFile(null);
    go(null);
  };

  if (file !== null) {
    return <LazyReplayScreen key="file" source={file} onLeave={leaveReplay} />;
  }
  if (where.replay !== null) {
    return (
      <LazyReplayScreen
        key={`world:${where.replay}`}
        source={{ kind: "world", worldId: where.replay }}
        onLeave={leaveReplay}
      />
    );
  }

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
      onWatch={watch}
      onReplayFile={(file) => {
        setMessage(null);
        setFile({ kind: "file", file });
      }}
    />
  );
}
