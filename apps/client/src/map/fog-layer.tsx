// The fog (M1.5 fog spec C-1) between what the team remembers (terrain,
// roads, road jobs, deposits, cores: the world layer below it) and the
// creeps, which are all in sight. fullView (the replay, team -1) has no fog.
// Its props are the view's arrays, which applyDelta keeps when they did not
// change: a delta that moves no sight redraws nothing.

import { memo } from "preact/compat";
import { COLORS } from "./colors.ts";
import { fogPaths } from "./fog.ts";
import { MapBorder } from "./static-layer.tsx";

export const FogLayer = memo(function FogLayer({
  team,
  known,
  visible,
  width,
}: {
  team: number;
  known: readonly number[];
  visible: readonly number[];
  width: number;
}) {
  if (team < 0) return null;
  const paths = fogPaths(known, visible, width);
  return (
    <g class="fog-layer" shape-rendering="crispEdges" pointer-events="none">
      <path d={paths.remembered} fill={COLORS.veil} fill-opacity="0.55" />
      <path d={paths.unseen} fill={COLORS.unseen} />
      <MapBorder width={width} height={Math.floor(known.length / width)} />
    </g>
  );
});
