// The map's alert while a battle of the team is in its opening pause (R spec
// D6, OC-3): who fights, the countdown and "Entrar", which dominates the D7
// creep and opens the battle screen (or opens it to watch).

import { sideTeam } from "@geometrix/sim";
import { entrarCreep, holdText } from "./battle-session.ts";
import { useNow } from "./battle-screen.tsx";
import { useGame } from "./context.ts";
import { teamName } from "./format.ts";

export function BattleAlert() {
  const { store, viewer, send, battles } = useGame();
  const opening = [...store.holds.value].filter(
    ([, hold]) => hold.state === "opening",
  );
  const now = useNow(opening.length > 0);
  const state = store.current.value?.state;
  if (battles === undefined || state === undefined) return null;
  if (store.shownBattle.value !== null || opening.length === 0) return null;
  return (
    <div class="battle-alerts">
      {opening.map(([id, hold]) => {
        const battle = state.battles.find((b) => b.id === id);
        // The hold may come before the delta that brings the battle.
        const creep = entrarCreep(state, viewer.playerId, viewer.team, id);
        const enter = async () => {
          if (creep !== null && creep !== undefined) {
            await send({ type: "dominate", creepId: creep });
          }
          battles.open(id);
        };
        return (
          <div key={id} class="battle-alert" role="alert">
            <strong>
              {battle === undefined
                ? "Batalha"
                : battle.sides.map((s) => teamName(sideTeam(s))).join(" × ")}
            </strong>
            <span>{holdText(hold, now)}</span>
            <button
              class="primary"
              disabled={creep === undefined || !store.canAct.value}
              onClick={() => void enter()}
            >
              Entrar
            </button>
          </div>
        );
      })}
    </div>
  );
}
