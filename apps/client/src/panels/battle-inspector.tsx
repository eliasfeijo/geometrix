// A battle selected by its sign on the map (junction D16, K-3): where and
// for how long it has been going, and each side with its team and the
// creeps the team can name (one out of sight is only its id).

import { sideTeam, type BattleStubView, type TeamView } from "@geometrix/sim";
import { Fragment } from "preact";
import { useGame } from "../context.ts";
import { DNA_NAMES, duration, teamName } from "../format.ts";
import { teamColor } from "../map/colors.ts";

/** The name of a participant as the team's view has it, else its id. */
export function participantName(state: TeamView, id: number): string {
  const fighter =
    state.creeps.find((c) => c.id === id) ??
    state.wanderers.find((w) => w.id === id);
  return fighter === undefined
    ? `#${id}`
    : `${fighter.name} (${DNA_NAMES[fighter.dna]})`;
}

/** World seconds since the battle opened. */
export function battleAge(
  battle: BattleStubView,
  tick: number,
  tickSeconds: number,
): number {
  return (tick - battle.openedTick) * tickSeconds;
}

export function BattleInspector({ id }: { id: number }) {
  const { store } = useGame();
  const state = store.current.value?.state;
  const params = store.info.value?.params;
  const battle = state?.battles.find((b) => b.id === id);
  if (state === undefined || params === undefined || battle === undefined) {
    return (
      <p class="muted">Essa batalha acabou ou saiu da visão do seu time.</p>
    );
  }
  const age = battleAge(battle, state.tick, params.world.tickSeconds);
  return (
    <div class="inspector">
      <h2 class="title">
        <span>
          Batalha
          <span class="subtitle muted">
            ({battle.x}, {battle.y}) · há {duration(age)} de mundo
          </span>
        </span>
      </h2>
      <dl class="facts">
        {battle.sides.map((side, i) => {
          const team = sideTeam(side);
          const names = battle.participants
            .filter((p) => p.side === i)
            .map((p) => participantName(state, p.id));
          return (
            <Fragment key={i}>
              <dt style={{ color: teamColor(team) }}>{teamName(team)}</dt>
              <dd>{names.length === 0 ? "ninguém mais" : names.join(", ")}</dd>
            </Fragment>
          );
        })}
      </dl>
    </div>
  );
}
