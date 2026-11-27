// What the live game and the replay share: the map, the panels and the keys.
// Where the states come from (the server or the sim in the browser) and what
// goes on top is up to the screen that renders it.

import { effect, useComputed } from "@preact/signals";
import type { ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";
import { BattleAlert } from "./battle-alert.tsx";
import { BattleReturn, BattleScreen } from "./battle-screen.tsx";
import { GameContext, type Game } from "./context.ts";
import {
  cursorAt,
  cursorStyle,
  handleKey,
  order,
  roadShortAt,
  select,
} from "./interaction.ts";
import { ChroniclePanel } from "./chronicle/chronicle-panel.tsx";
import { CreepLayer } from "./map/creep-layer.tsx";
import { ConcedeVotePanel } from "./concede.tsx";
import { EndOverlay } from "./end-screen.tsx";
import { MapView } from "./map/map-view.tsx";
import { RoadJobTimeLayer } from "./map/road-job-time-layer.tsx";
import {
  BuilderPlanLayer,
  RoadPreviewLayer,
} from "./map/road-preview-layer.tsx";
import { StockFloatLayer } from "./map/stock-float-layer.tsx";
import { ModeBanner } from "./mode-banner.tsx";
import { ApproachMenu } from "./panels/approach-menu.tsx";
import { CoreDock } from "./panels/core-panel.tsx";
import { Inspector } from "./panels/inspector.tsx";
import { ReactionPanel } from "./panels/reaction-panel.tsx";
import { ActorList } from "./panels/actor-list.tsx";
import { Notices } from "./top-bar.tsx";

type Props = {
  game: Game;
  /** The bar above the map. */
  header: ComponentChildren;
  /** Whether a right click gives orders (false in a replay). */
  orders: boolean;
  /** "Ver o replay" on the end screen; none in a replay. */
  onReplay?: () => void;
};

export function GameLayout({ game, header, orders, onReplay }: Props) {
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
  // A replay seeking back leaves the end: the next one opens again.
  useEffect(
    () =>
      effect(() => {
        if (store.result.value === null) store.endHidden.value = false;
      }),
    [],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // The end screen covers the map.
      if (store.result.value !== null && !store.endHidden.value) return;
      // The battle screen has the keyboard while it is shown.
      if (store.shownBattle.value !== null) return;
      if (handleKey(store, game.viewer.team, e)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game]);

  // A signal bound to the map's style: the pointer moving does not render
  // the layout again.
  const { team } = game.viewer;
  const roadShort = useComputed(() => roadShortAt(store, team));
  const cursor = useComputed(() =>
    cursorStyle(
      cursorAt(store, orders, team, roadShort.value, performance.now()),
    ),
  );

  // An ended world, or a team out, is read-only (E-min D6, D7).
  const live = orders && store.result.value === null && !store.teamOut.value;

  return (
    <GameContext.Provider value={game}>
      <div class="game">
        {header}
        <div class="game-body">
          <MapView
            cursor={cursor}
            onSelect={(point, px) =>
              select(store, point, px, performance.now())
            }
            onOrder={
              live
                ? (point, px) =>
                    order(store, point, game.send, performance.now(), px)
                : undefined
            }
          >
            <BuilderPlanLayer />
            <CreepLayer />
            <RoadJobTimeLayer />
            <StockFloatLayer />
            <RoadPreviewLayer />
          </MapView>
          <CoreDock />
          <div class="right-column">
            <Inspector />
            <ChroniclePanel />
          </div>
          <ModeBanner />
          <ActorList />
          {live && <ApproachMenu />}
          {live && <ReactionPanel />}
          {live && <BattleReturn />}
          {live && <BattleAlert />}
          {live && <ConcedeVotePanel />}
          {store.shownBattle.value !== null && game.battles !== undefined && (
            <BattleScreen key={store.shownBattle.value} />
          )}
          <EndOverlay onReplay={onReplay} />
        </div>
        <Notices />
      </div>
    </GameContext.Provider>
  );
}
