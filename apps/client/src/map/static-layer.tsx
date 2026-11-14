// Terrain, river, crossings and rocks: drawn once per welcome.

import { Terrain } from "@geometrix/sim";
import { memo } from "preact/compat";
import type { WorldInfo } from "../store.ts";
import { COLORS } from "./colors.ts";
import { terrainRuns } from "./terrain.ts";

const TERRAIN_COLORS: Record<Terrain, string> = {
  [Terrain.jungle]: COLORS.jungle,
  [Terrain.river]: COLORS.river,
  [Terrain.crossing]: COLORS.crossing,
  [Terrain.rock]: COLORS.rock,
};

export const StaticLayer = memo(function StaticLayer({
  map,
}: {
  map: WorldInfo["map"];
}) {
  const runs = terrainRuns(map);
  return (
    <g class="static-layer">
      <defs>
        <pattern id="grid" width="1" height="1" patternUnits="userSpaceOnUse">
          <path
            d="M 1 0 H 0 V 1"
            fill="none"
            stroke={COLORS.jungleGrid}
            stroke-width="0.04"
          />
        </pattern>
        <pattern
          id="crossing"
          width="0.5"
          height="0.5"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="0.5" height="0.5" fill={COLORS.crossing} />
          <rect width="0.12" height="0.5" fill={COLORS.river} opacity="0.5" />
        </pattern>
      </defs>
      <rect
        x="0"
        y="0"
        width={map.width}
        height={map.height}
        fill={COLORS.jungle}
      />
      <rect
        x="0"
        y="0"
        width={map.width}
        height={map.height}
        fill="url(#grid)"
      />
      <g shape-rendering="crispEdges">
        {runs.map((run) => (
          <rect
            key={`${run.x},${run.y}`}
            x={run.x}
            y={run.y}
            width={run.length}
            height="1"
            fill={
              run.terrain === Terrain.crossing
                ? "url(#crossing)"
                : TERRAIN_COLORS[run.terrain]
            }
          />
        ))}
      </g>
      <rect
        x="0"
        y="0"
        width={map.width}
        height={map.height}
        fill="none"
        stroke={COLORS.rock}
        stroke-width="0.1"
      />
    </g>
  );
});
