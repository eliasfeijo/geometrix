// "+N" and "−N" rising from each core when its stock changes (F9): what the
// creeps delivered and what the team paid, in the resource's color.

import { effect, useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { useGame } from "../context.ts";
import { COLORS } from "./colors.ts";
import { CORE_RADIUS } from "./world-layer.tsx";
import { addFloats, stockDeltas, type StockFloat } from "./stock-floats.ts";

/** Size of the numbers on screen, in pixels. */
const FLOAT_FONT_PX = 15;

export function StockFloatLayer() {
  const { store } = useGame();
  const floats = useSignal<StockFloat[]>([]);
  useEffect(() => {
    let nextId = 1;
    return effect(() => {
      const previous = store.previous.value;
      const current = store.current.value;
      if (previous === null || current === null) return;
      const deltas = stockDeltas(previous.state, current.state);
      if (deltas.length === 0) return;
      floats.value = addFloats(
        floats.peek(),
        deltas,
        performance.now(),
        () => nextId++,
      );
    });
  }, []);
  const state = store.current.value?.state;
  const scale = store.view.value?.scale;
  if (state === undefined || scale === undefined) return null;
  const size = FLOAT_FONT_PX / scale;
  return (
    <g class="stock-floats">
      {floats.value.map((f) => {
        const core = state.teams[f.team]?.core;
        if (core === undefined || core === null) return null;
        // Deliveries rise above the core, payments beside it: materia on
        // the left, cristal on the right.
        const side = f.resource === "materia" ? -1 : 1;
        const paid = f.amount < 0;
        const x = paid
          ? core.x + 0.5 + side * (CORE_RADIUS + size * 1.8)
          : core.x + 0.5 + side * size * 1.4;
        const y = paid ? core.y + 0.5 : core.y + 0.5 - CORE_RADIUS - 0.2;
        return (
          <text
            key={f.id}
            class="map-text stock-float"
            x={x}
            y={y}
            font-size={size}
            stroke-width={size * 0.3}
            fill={paid ? COLORS.paid : COLORS[f.resource]}
            text-anchor="middle"
            style={{ "--rise": `${-size * 2.2}px` }}
          >
            {paid ? `−${-f.amount}` : `+${f.amount}`}
          </text>
        );
      })}
    </g>
  );
}
