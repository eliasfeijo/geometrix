// The selected creep's destination (R spec D19, U-1): a line along its path
// and a marker where its order takes it. Only for a creep of the team: the
// view has no other creep's order.

import type { CreepView, TeamView } from "@geometrix/sim";
import { useMemo } from "preact/hooks";
import { useGame } from "../context.ts";
import { COLORS } from "./colors.ts";
import { routeOf, viewMap } from "./destination.ts";
import type { Point } from "./view.ts";

export function DestinationLayer(props: {
  creep: CreepView;
  /** Where the creep is drawn now. */
  from: Point;
  state: TeamView;
}) {
  const { creep, from, state } = props;
  const { store } = useGame();
  const known = store.map.value;
  const params = store.info.value?.params;
  const map = useMemo(
    () => (known === null ? null : viewMap(known, state.roads)),
    [known, state.roads],
  );
  if (map === null || params === undefined) return null;
  const route = routeOf(creep, state, params, map);
  if (route === null) return null;
  const x = route.cell.x + 0.5;
  const y = route.cell.y + 0.5;
  const points = [
    `${from.x},${from.y}`,
    ...route.path.map(
      (i) => `${(i % map.width) + 0.5},${Math.floor(i / map.width) + 0.5}`,
    ),
  ];
  return (
    <g class="destination" pointer-events="none">
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={COLORS.selection}
        stroke-opacity="0.8"
        stroke-width="0.07"
        stroke-dasharray="0.2 0.15"
        stroke-linejoin="round"
      />
      <circle
        cx={x}
        cy={y}
        r="0.34"
        fill="none"
        stroke={COLORS.selection}
        stroke-width="0.08"
      />
      <circle cx={x} cy={y} r="0.1" fill={COLORS.selection} />
    </g>
  );
}
