// The hostile sign (R spec D25, HS-2): over a creep or wanderer chasing
// someone to attack it (a sword) or to extort it (a purse), in red; for the
// team's own target, a red line from the aggressor to its creep.

import type { TeamView } from "@geometrix/sim";
import { COLORS } from "./colors.ts";
import { hostileMarks } from "./combat-marks.ts";
import { markerOf, type Marker } from "./layout.ts";
import { markerScale, type Point } from "./view.ts";

/** On-screen height of the sign, in pixels, and its cap in cells. */
const SIGN_PX = 16;
const SIGN_MAX_CELLS = 0.7;
/** How far above the creep's middle the sign stands, in cells at scale 1. */
const SIGN_ABOVE = 0.55;

export function HostileLayer(props: {
  state: TeamView;
  markers: readonly Marker[];
  /** Pixels per cell. */
  viewScale: number;
}) {
  const { state, markers, viewScale } = props;
  const marks = hostileMarks(state);
  if (marks.length === 0) return null;
  const zoom = markerScale(viewScale);
  const at = (id: number): (Point & { scale: number }) | undefined => {
    const marker = markerOf(markers, id);
    if (marker !== undefined) return marker;
    const w = state.wanderers.find((w) => w.id === id);
    return w === undefined
      ? undefined
      : { x: w.x + 0.5, y: w.y + 0.5, scale: zoom };
  };
  const size = Math.min(SIGN_PX / viewScale, SIGN_MAX_CELLS);
  return (
    <g class="hostile-layer" pointer-events="none">
      {marks.map((mark) => {
        const from = at(mark.from);
        if (from === undefined) return null;
        const to = mark.to === null ? undefined : at(mark.to);
        return (
          <g key={mark.from} class={`hostile hostile-${mark.intent}`}>
            {to !== undefined && (
              <line
                class="hostile-line"
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={COLORS.fight}
                stroke-width="0.08"
                stroke-opacity="0.9"
              />
            )}
            <g
              transform={`translate(${from.x} ${from.y - SIGN_ABOVE * from.scale - size / 2}) scale(${size})`}
            >
              <circle r="0.62" fill={COLORS.background} />
              {mark.intent === "attack" ? <Sword /> : <Purse />}
            </g>
          </g>
        );
      })}
    </g>
  );
}

/** A sword's silhouette, in a unit box around the origin. */
function Sword() {
  return (
    <path
      d="M0-.5L.09-.36V.12H.26V.22H.07V.42H.11V.5H-.11V.42H-.07V.22H-.26V.12H-.09V-.36Z"
      fill={COLORS.fight}
      transform="rotate(35)"
    />
  );
}

/** A tied purse, in a unit box around the origin. */
function Purse() {
  return (
    <path
      d="M-.2-.45H.2L.08-.24C.36-.14.46.1.46.24C.46.42.28.48 0 .48S-.46.42-.46.24C-.46.1-.36-.14-.08-.24Z"
      fill={COLORS.fight}
    />
  );
}
