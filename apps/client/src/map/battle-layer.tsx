// The battles on the map (junction D16, K-3): the bubble, a thin dashed
// outline of the window the arena is made of (who enters it attacking a
// participant joins, D6), and a sign over the battle's cell with the colors
// of its sides; clicking the sign selects the battle (the inspector offers
// watching it, D11). The participants themselves carry an "in battle" mark
// (creep-layer.tsx).

import { sideTeam, type BattleStubView } from "@geometrix/sim";
import { COLORS, teamColor } from "./colors.ts";
import { battleSign } from "./combat-marks.ts";
import { arcDash } from "./shapes.ts";

/** The bubbles, under the creeps. */
export function BattleBubbles({
  battles,
}: {
  battles: readonly BattleStubView[];
}) {
  return (
    <g class="battle-bubbles" pointer-events="none">
      {battles.map((b) => (
        <rect
          key={b.id}
          x={b.window.x}
          y={b.window.y}
          width={b.window.width}
          height={b.window.height}
          fill={COLORS.fight}
          fill-opacity={0.04}
          stroke={COLORS.fight}
          stroke-opacity={0.55}
          stroke-width={0.06}
          stroke-dasharray="0.3 0.2"
        />
      ))}
    </g>
  );
}

/** The signs, over the creeps and their names. */
export function BattleSigns(props: {
  battles: readonly BattleStubView[];
  viewScale: number;
  selected: number | null;
}) {
  return (
    <g class="battle-signs">
      {props.battles.map((b) => (
        <BattleSign
          key={b.id}
          battle={b}
          viewScale={props.viewScale}
          selected={b.id === props.selected}
        />
      ))}
    </g>
  );
}

/**
 * A disc split in arcs, one per side in its team's color, with two crossed
 * blades in the middle.
 */
function BattleSign(props: {
  battle: BattleStubView;
  viewScale: number;
  selected: boolean;
}) {
  const { x, y, r } = battleSign(props.battle, props.viewScale);
  const { sides } = props.battle;
  const ring = r * 0.82;
  const share = 1 / Math.max(sides.length, 1);
  const arm = r * 0.42;
  return (
    <g class="battle-sign">
      {props.selected && (
        <circle
          cx={x}
          cy={y}
          r={r * 1.3}
          fill="none"
          stroke={COLORS.selection}
          stroke-width={r * 0.14}
          stroke-dasharray={`${r * 0.35} ${r * 0.2}`}
        />
      )}
      <circle cx={x} cy={y} r={r} fill={COLORS.background} />
      {sides.map((side, i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={ring}
          fill="none"
          stroke={teamColor(sideTeam(side))}
          stroke-width={r * 0.3}
          stroke-dasharray={arcDash(ring, share)}
          transform={`rotate(${-90 + i * share * 360} ${x} ${y})`}
        />
      ))}
      <g stroke={COLORS.outline} stroke-width={r * 0.16} stroke-linecap="round">
        <line x1={x - arm} y1={y - arm} x2={x + arm} y2={y + arm} />
        <line x1={x - arm} y1={y + arm} x2={x + arm} y2={y - arm} />
      </g>
    </g>
  );
}

/** The "in battle" mark on a participant: a small pair of crossed blades. */
export function InBattleMark(props: { x: number; y: number; size: number }) {
  const s = 0.1 * Math.max(props.size, 1);
  const { x, y } = props;
  return (
    <g class="in-battle">
      <circle cx={x} cy={y} r={s * 1.7} fill={COLORS.fight} />
      <g
        stroke={COLORS.background}
        stroke-width={s * 0.45}
        stroke-linecap="round"
      >
        <line x1={x - s} y1={y - s} x2={x + s} y2={y + s} />
        <line x1={x - s} y1={y + s} x2={x + s} y2={y - s} />
      </g>
    </g>
  );
}
