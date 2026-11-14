// What the live game and the replay share: the map, the panels and the keys.
// Where the states come from (the server or the sim in the browser) and what
// goes on top is up to the screen that renders it.

import { effect } from "@preact/signals";
import type { ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";
import { GameContext, type Game } from "./context.ts";
import { handleKey, order, select } from "./interaction.ts";
import { CreepLayer } from "./map/creep-layer.tsx";
import { MapView } from "./map/map-view.tsx";
import { StockFloatLayer } from "./map/stock-float-layer.tsx";
import { ModeBanner } from "./mode-banner.tsx";
import { CoreDock } from "./panels/core-panel.tsx";
import { Inspector } from "./panels/inspector.tsx";
import { StackList } from "./panels/stack-list.tsx";
import { Notices } from "./top-bar.tsx";

type Props = {
  game: Game;
  /** The bar above the map. */
  header: ComponentChildren;
  /** Whether a right click gives orders (false in a replay). */
  orders: boolean;
};

export function GameLayout({ game, header, orders }: Props) {
  const { store } = game;
  // Road mode ends with the domination it needs.
  useEffect(
    () =>
      effect(() => {
        if (store.mode.value.type === "road" && store.myCreep.value === null) {
          store.mode.value = { type: "select" };
        }
      }),
    [],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (handleKey(store, game.viewer.team, e)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game]);

  return (
    <GameContext.Provider value={game}>
      <div class="game">
        {header}
        <div class="game-body">
          <MapView
            onSelect={(point, px) =>
              select(store, point, px, performance.now())
            }
            onOrder={
              orders
                ? (point) => order(store, point, game.send, performance.now())
                : undefined
            }
          >
            <CreepLayer />
            <StockFloatLayer />
          </MapView>
          <CoreDock />
          <Inspector />
          <ModeBanner />
          <StackList />
        </div>
        <Notices />
      </div>
    </GameContext.Provider>
  );
}
