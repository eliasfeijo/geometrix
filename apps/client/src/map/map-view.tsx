// The strategic map (spec C-1): an SVG whose viewBox follows pan and zoom.
// Left drag (or middle drag) pans, the wheel zooms at the pointer, a left
// click selects and a right click orders (owner decision, F7).

import { useComputed } from "@preact/signals";
import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { useGame } from "../context.ts";
import { COLORS } from "./colors.ts";
import { StaticLayer } from "./static-layer.tsx";
import {
  fitView,
  markerScale,
  panBy,
  toMap,
  viewBoxAttribute,
  zoomAt,
  type Point,
} from "./view.ts";
import { WorldLayer } from "./world-layer.tsx";

/** Pixels a press may move and still count as a click. */
const CLICK_SLOP = 5;
/** Zoom per wheel pixel (exponential, so in and out are symmetric). */
const WHEEL_ZOOM = 0.0015;
/** Pixels an arrow key pans. */
const KEY_PAN = 80;

type Props = {
  onSelect?(point: Point, event: MouseEvent): void;
  onOrder?(point: Point, event: MouseEvent): void;
  /** Layers drawn above the world (creeps, selection). */
  children?: ComponentChildren;
};

type Drag = {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  moved: boolean;
  button: number;
};

export function MapView({ onSelect, onOrder, children }: Props) {
  const { store } = useGame();
  const info = store.info.value;
  const element = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  const viewBoxValue = useComputed(() => {
    const view = store.view.value;
    const size = store.mapSize.value;
    return view === null || size.width === 0
      ? "0 0 1 1"
      : viewBoxAttribute(view, size);
  });

  // Track the element size; the first size fits the whole map.
  useEffect(() => {
    const el = element.current;
    if (el === null || info === null) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry!.contentRect;
      if (width === 0 || height === 0) return;
      store.mapSize.value = { width, height };
      if (store.view.value === null) {
        store.view.value = fitView(info.map, { width, height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [info]);

  // The wheel listener must not be passive to stop the page from scrolling.
  useEffect(() => {
    const el = element.current;
    if (el === null || info === null) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const view = store.view.value;
      if (view === null) return;
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      store.view.value = zoomAt(
        view,
        store.mapSize.value,
        local(el, e),
        Math.exp(-delta * WHEEL_ZOOM),
        info.map,
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [info]);

  if (info === null) {
    return <div class="map map-placeholder muted">Conectando ao mundo…</div>;
  }

  const mapPoint = (e: MouseEvent): Point | null => {
    const view = store.view.value;
    if (view === null || element.current === null) return null;
    return toMap(view, store.mapSize.value, local(element.current, e));
  };

  const pan = (dx: number, dy: number) => {
    const view = store.view.value;
    if (view !== null) {
      store.view.value = panBy(view, store.mapSize.value, dx, dy, info.map);
    }
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    if (e.button === 1) e.preventDefault();
    element.current?.setPointerCapture(e.pointerId);
    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      moved: false,
      button: e.button,
    };
  };

  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (d === null || d.pointerId !== e.pointerId) return;
    if (
      !d.moved &&
      Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > CLICK_SLOP
    ) {
      d.moved = true;
    }
    if (d.moved) pan(e.clientX - d.lastX, e.clientY - d.lastY);
    d.lastX = e.clientX;
    d.lastY = e.clientY;
  };

  const onPointerUp = (e: PointerEvent) => {
    const d = drag.current;
    if (d === null || d.pointerId !== e.pointerId) return;
    drag.current = null;
    if (!d.moved && d.button === 0) {
      const point = mapPoint(e);
      if (point !== null) onSelect?.(point, e);
    }
  };

  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    const point = mapPoint(e);
    if (point !== null) onOrder?.(point, e);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [KEY_PAN, 0],
      ArrowRight: [-KEY_PAN, 0],
      ArrowUp: [0, KEY_PAN],
      ArrowDown: [0, -KEY_PAN],
    };
    const move = moves[e.key];
    if (move !== undefined) {
      e.preventDefault();
      pan(move[0], move[1]);
    } else if (e.key === "+" || e.key === "=" || e.key === "-") {
      const view = store.view.value;
      if (view === null) return;
      const size = store.mapSize.value;
      store.view.value = zoomAt(
        view,
        size,
        { x: size.width / 2, y: size.height / 2 },
        e.key === "-" ? 1 / 1.25 : 1.25,
        info.map,
      );
    } else if (e.key === "0") {
      store.view.value = fitView(info.map, store.mapSize.value);
    }
  };

  const state = store.current.value?.state;
  return (
    <div
      ref={element}
      class={`map mode-${store.mode.value.type}`}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (drag.current = null)}
      onContextMenu={onContextMenu}
      onKeyDown={onKeyDown}
    >
      <svg
        viewBox={viewBoxValue}
        width="100%"
        height="100%"
        style={{ background: COLORS.background }}
      >
        <StaticLayer map={info.map} />
        {state !== undefined && (
          <WorldLayer
            state={state}
            params={info.params}
            width={info.map.width}
            zoom={markerScale(store.view.value?.scale ?? 1)}
          />
        )}
        {children}
      </svg>
    </div>
  );
}

function local(el: Element, e: MouseEvent): Point {
  const rect = el.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}
