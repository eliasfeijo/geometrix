import type { ClientCommand } from "@geometrix/protocol";
import { createContext } from "preact";
import { useContext } from "preact/hooks";
import type { BattleControl } from "./battle-control.ts";
import type { GameStore } from "./store.ts";

/**
 * Whose eyes the screen uses: the player (own team's panels, own creep
 * highlighted) or, in a replay, a spectator of one team with no player id.
 */
export type Viewer = { playerId: number; team: number };

export type Game = {
  store: GameStore;
  viewer: Viewer;
  /** Sends a command; a reject shows up as a notice. True when acked. */
  send(command: ClientCommand): Promise<boolean>;
  /** The battle screen (junction D11); none in a replay. */
  battles?: BattleControl;
  /**
   * The world's real ×N where the welcome does not tell it (a replay): the
   * end screen's real duration (E-min P9).
   */
  multiplier?: number;
};

export const GameContext = createContext<Game | null>(null);

export function useGame(): Game {
  const game = useContext(GameContext);
  if (game === null) throw new Error("useGame outside a GameContext");
  return game;
}
