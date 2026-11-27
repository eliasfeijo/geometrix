// Road mode feedback (F9, owner decision): the road a right click on the cell
// under the pointer would build, and its cost, red when the stock is short.

import { isOwnCreep } from "@geometrix/sim";
import { useMemo } from "preact/hooks";
import { useGame } from "../context.ts";
import { COLORS } from "./colors.ts";
import { builderPlan, roadPreview, type RoadPlan } from "./road-plan.ts";

/** On-screen size of the cost text, in pixels. */
const TEXT_PX = 13;

export function RoadPreviewLayer() {
  const { store, viewer } = useGame();
  const info = store.info.value;
  const map = store.map.value;
  const state = store.current.value?.state;
  const cell = store.pointerCell.value;
  const active = store.mode.value.type === "road" && cell !== null;
  const preview = useMemo(
    () =>
      !active || info === null || map === null || state === undefined
        ? null
        : roadPreview(map, state, info.params, viewer.team, cell),
    [
      active,
      cell?.x,
      cell?.y,
      state?.roads,
      state?.roadJobs,
      state?.teams,
      state?.known,
      map,
      viewer.team,
    ],
  );
  if (preview === null || cell === null || info === null) return null;

  const { plan, text, short } = preview;
  const width = info.map.width;
  const fontSize = TEXT_PX / (store.view.value?.scale ?? 1);
  return (
    <g class="road-preview">
      {plan.kind === "plan" && <PlanCells plan={plan} width={width} />}
      <rect
        x={cell.x}
        y={cell.y}
        width="1"
        height="1"
        fill="none"
        stroke={short ? COLORS.paid : COLORS.road}
        stroke-width={0.06}
      />
      <text
        class="map-text road-cost"
        x={cell.x + 0.5}
        y={cell.y - 0.15}
        font-size={fontSize}
        stroke-width={fontSize * 0.28}
        fill={short ? COLORS.paid : COLORS.outline}
        text-anchor="middle"
      >
        {text}
      </text>
    </g>
  );
}

/**
 * The cells of a road plan: those to pay, those already paid (fainter) and a
 * cross where it stops.
 */
export function PlanCells({
  plan,
  width,
}: {
  plan: Extract<RoadPlan, { kind: "plan" }>;
  width: number;
}) {
  const at = (i: number) => ({ x: i % width, y: Math.floor(i / width) });
  return (
    <>
      {[...plan.paid, ...plan.free].map((i) => {
        const c = at(i);
        return (
          <rect
            key={i}
            x={c.x + 0.08}
            y={c.y + 0.08}
            width="0.84"
            height="0.84"
            fill={COLORS.road}
            opacity={plan.paid.includes(i) ? 0.5 : 0.25}
          />
        );
      })}
      {plan.blockedAt !== null && <BlockedMark {...at(plan.blockedAt)} />}
    </>
  );
}

/** The selected road builder's plan from the core to its deposit (D13). */
export function BuilderPlanLayer() {
  const { store } = useGame();
  const info = store.info.value;
  const map = store.map.value;
  const state = store.current.value?.state;
  const selection = store.selection.value;
  const creep =
    selection?.kind === "creep"
      ? state?.creeps.find((c) => c.id === selection.id)
      : undefined;
  const own = creep !== undefined && isOwnCreep(creep) ? creep : null;
  const builder = useMemo(
    () =>
      own === null || info === null || map === null || state === undefined
        ? null
        : builderPlan(map, state, info.params, own),
    [
      own?.id,
      own?.rules,
      own?.dominatedBy,
      state?.roads,
      state?.roadJobs,
      state?.deposits,
      map,
    ],
  );
  if (builder === null || builder.kind === "none" || info === null) return null;
  const { x, y } = builder.target;
  return (
    <g class="builder-plan" pointer-events="none">
      <PlanCells plan={builder.plan} width={info.map.width} />
      <rect
        x={x}
        y={y}
        width="1"
        height="1"
        fill="none"
        stroke={COLORS.road}
        stroke-width="0.08"
      />
    </g>
  );
}

/** A small cross on the cell where the road would stop. */
function BlockedMark({ x, y }: { x: number; y: number }) {
  const a = 0.3;
  const b = 0.7;
  return (
    <path
      d={`M${x + a},${y + a}L${x + b},${y + b}M${x + b},${y + a}L${x + a},${y + b}`}
      stroke={COLORS.paid}
      stroke-width="0.08"
      stroke-linecap="round"
    />
  );
}
