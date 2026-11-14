import type { Dna } from "@geometrix/sim";
import { trianglePoints } from "./shapes.ts";

type Props = {
  dna: Dna;
  cx: number;
  cy: number;
  /** Radius of the circle the shape fits in. */
  r: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
};

/** ■ square, ▲ triangle, ● circle (spec C-1: shape = DNA). */
export function DnaShape({ dna, cx, cy, r, fill, stroke, strokeWidth }: Props) {
  const paint = {
    fill: fill ?? "none",
    stroke,
    "stroke-width": strokeWidth,
  };
  switch (dna) {
    case "square": {
      const side = r * 1.5;
      return (
        <rect
          x={cx - side / 2}
          y={cy - side / 2}
          width={side}
          height={side}
          {...paint}
        />
      );
    }
    case "triangle":
      return (
        <polygon
          points={trianglePoints(cx, cy + r * 0.15, r * 1.15)}
          {...paint}
        />
      );
    case "circle":
      return <circle cx={cx} cy={cy} r={r * 0.85} {...paint} />;
  }
}
