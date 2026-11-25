import type { Dna } from "@geometrix/sim";
import { teamColor } from "../map/colors.ts";
import { DnaShape } from "../map/creep-shape.tsx";

/** `team` null is the wanderers' side. */
export function DnaIcon(props: {
  dna: Dna;
  team: number | null;
  size?: number;
}) {
  const size = props.size ?? 18;
  return (
    <svg class="icon" viewBox="0 0 1 1" width={size} height={size}>
      <DnaShape
        dna={props.dna}
        cx={0.5}
        cy={0.5}
        r={0.42}
        fill={teamColor(props.team)}
      />
    </svg>
  );
}
