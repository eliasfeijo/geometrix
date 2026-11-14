import type { ClientCommand } from "@geometrix/protocol";
import { createContext } from "preact";
import { useContext } from "preact/hooks";
import type { Session } from "./session.ts";
import type { GameStore } from "./store.ts";

export type Game = {
  store: GameStore;
  session: Session;
  /** Sends a command; a reject shows up as a notice. True when acked. */
  send(command: ClientCommand): Promise<boolean>;
};

export const GameContext = createContext<Game | null>(null);

export function useGame(): Game {
  const game = useContext(GameContext);
  if (game === null) throw new Error("useGame outside a GameContext");
  return game;
}
