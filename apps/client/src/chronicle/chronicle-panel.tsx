// The chronicle (M2 encontro spec C-4, plan section 9): the team's events as
// sentences, newest on top, in a panel on the right that folds away. A
// creep's name selects it and centers the map on it while it is in the view
// (alive, and in sight for another team's creep).

import type { CreepRef, TeamEvent } from "@geometrix/sim";
import { useState } from "preact/hooks";
import { useGame } from "../context.ts";
import { worldClock } from "../format.ts";
import { teamTextColor } from "../map/colors.ts";
import { centerOn } from "../map/view.ts";
import { narrate } from "./narrate.ts";

export function ChroniclePanel() {
  const { store } = useGame();
  const [open, setOpen] = useState(true);
  const events = store.chronicle.value;
  // fullView (the replay, team -1) sees the whole world.
  const whole = (store.current.value?.state.team ?? 0) < 0;
  const tickSeconds = store.info.value?.params.world.tickSeconds ?? 1;
  return (
    <section
      class={`chronicle panel ${open ? "" : "collapsed"}`}
      aria-label="Crônica"
    >
      <button
        class="ghost chronicle-head"
        aria-expanded={open}
        title={open ? "Recolher a crônica" : "Abrir a crônica"}
        onClick={() => setOpen(!open)}
      >
        <strong>Crônica</strong>
        <span class="muted small">{events.length}</span>
        <span class="chronicle-toggle">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <ol class="chronicle-list">
          {events.length === 0 && (
            <li class="muted">
              {whole
                ? "Nada aconteceu ainda."
                : "Nada aconteceu à vista do seu time ainda."}
            </li>
          )}
          {[...events].reverse().map((event) => (
            <Entry
              key={`${event.tick}.${event.index}`}
              event={event}
              tickSeconds={tickSeconds}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function Entry({
  event,
  tickSeconds,
}: {
  event: TeamEvent;
  tickSeconds: number;
}) {
  const clock = worldClock(event.tick, tickSeconds).split(" · ")[1];
  return (
    <li class={`chronicle-entry event-${event.type}`}>
      <span class="chronicle-time muted small">{clock}</span>
      <span>
        {narrate(event).map((segment, i) =>
          typeof segment === "string" ? (
            segment
          ) : (
            <CreepName key={i} creep={segment.creep} />
          ),
        )}
      </span>
    </li>
  );
}

function CreepName({ creep }: { creep: CreepRef }) {
  const { store } = useGame();
  const go = () => {
    const now = performance.now();
    const state = store.current.value?.state;
    const found = state?.creeps.find((c) => c.id === creep.id);
    if (found === undefined) {
      store.notify(`${creep.name} não está à vista.`, now);
      return;
    }
    store.selection.value = { kind: "creep", id: creep.id };
    const view = store.view.value;
    const info = store.info.value;
    if (view !== null && info !== null) {
      store.view.value = centerOn(view, found, info.map, store.mapSize.value);
    }
  };
  return (
    <button
      class="creep-link"
      style={{ color: teamTextColor(creep.team) }}
      onClick={go}
    >
      {creep.name}
    </button>
  );
}
