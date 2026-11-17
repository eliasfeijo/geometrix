// The encounters on the map (M2 encontro spec C-3, plan section 9): a dashed
// line from an own creep to the enemy it chases; a "!" between the two sides
// of a dialogue, with the seconds left in the window; a red stroke with the
// rounds in a fight; a short trail behind a fleeing creep.

import { isOwnCreep, type Params, type TeamView } from "@geometrix/sim";
import { COLORS } from "./colors.ts";
import { linksOf, type Link } from "./combat-marks.ts";
import { markerOf, type Marker } from "./layout.ts";
import type { Point } from "./view.ts";

type Props = {
  state: TeamView;
  params: Params;
  markers: readonly Marker[];
  /** Pixels per cell: the badges keep a readable size on screen. */
  viewScale: number;
};

export function EncounterLayer({ state, params, markers, viewScale }: Props) {
  const links = linksOf(state, params);
  const at = (id: number) => markerOf(markers, id);
  return (
    <g class="encounter-layer" pointer-events="none">
      {state.creeps.map((creep) => {
        if (!isOwnCreep(creep) || creep.order.type !== "flee") return null;
        const marker = at(creep.id);
        const core = state.teams[creep.team]?.core;
        if (marker === undefined || core === undefined || core === null) {
          return null;
        }
        return <FleeTrail key={`f${creep.id}`} from={marker} core={core} />;
      })}
      {links.map((link) => {
        const from = at(link.from);
        const to = at(link.to);
        if (from === undefined || to === undefined) return null;
        return (
          <LinkMark
            key={link.kind === "chase" ? `c${link.from}` : `e${link.encounter}`}
            link={link}
            from={from}
            to={to}
            viewScale={viewScale}
          />
        );
      })}
    </g>
  );
}

function LinkMark(props: {
  link: Link;
  from: Point;
  to: Point;
  viewScale: number;
}) {
  const { link, from, to } = props;
  // A badge about 16 px tall on screen, never bigger than a cell.
  const size = Math.min(16 / props.viewScale, 0.9);
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  if (link.kind === "chase") {
    return (
      <line
        class="chase-line"
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={link.intent === "attack" ? COLORS.fight : COLORS.selection}
        stroke-opacity="0.85"
        stroke-width={0.06}
        stroke-dasharray="0.25 0.15"
      />
    );
  }
  const fight = link.kind === "fight";
  const label = fight
    ? link.rounds === null
      ? null
      : `${link.rounds}`
    : link.seconds === null
      ? null
      : `${link.seconds}s`;
  return (
    <g class={fight ? "fight-mark" : "dialogue-mark"}>
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={fight ? COLORS.fight : COLORS.selection}
        stroke-width={fight ? 0.12 : 0.05}
        stroke-linecap="round"
      />
      <circle
        cx={mid.x}
        cy={mid.y}
        r={size * 0.5}
        fill={COLORS.background}
        stroke={fight ? COLORS.fight : COLORS.selection}
        stroke-width={size * 0.08}
      />
      <text
        class="map-text"
        x={mid.x}
        y={mid.y}
        font-size={size * 0.7}
        fill={fight ? COLORS.fight : COLORS.selection}
        font-weight="700"
        text-anchor="middle"
        dominant-baseline="central"
      >
        {fight ? "⚔" : "!"}
      </text>
      {label !== null && (
        <text
          class="map-text encounter-label"
          x={mid.x}
          y={mid.y - size * 0.6}
          font-size={size * 0.6}
          stroke-width={size * 0.15}
          fill={COLORS.outline}
          text-anchor="middle"
        >
          {label}
        </text>
      )}
    </g>
  );
}

/** A short fading trail behind a fleeing creep, away from its core. */
function FleeTrail({ from, core }: { from: Point; core: Point }) {
  const dx = core.x + 0.5 - from.x;
  const dy = core.y + 0.5 - from.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.5) return null;
  const ux = dx / length;
  const uy = dy / length;
  return (
    <g class="flee-trail">
      {[0.5, 0.8, 1.1].map((d, i) => (
        <line
          key={d}
          x1={from.x - ux * d}
          y1={from.y - uy * d}
          x2={from.x - ux * (d + 0.2)}
          y2={from.y - uy * (d + 0.2)}
          stroke={COLORS.outline}
          stroke-opacity={0.6 - i * 0.18}
          stroke-width={0.07}
          stroke-linecap="round"
        />
      ))}
    </g>
  );
}
