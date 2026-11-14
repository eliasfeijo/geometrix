// The time each road job still needs (F9, owner decision), over its cell and
// above the creeps, since the builder stands on the cell. Only where a cell
// is large enough on screen.

import { useGame } from "../context.ts";
import { duration } from "../format.ts";
import { COLORS } from "./colors.ts";

/** Smallest on-screen cell (pixels) where a road job shows its time. */
export const JOB_TIME_MIN_PX = 22;
/** On-screen size of the time, in pixels. */
const JOB_TIME_PX = 11;

export function RoadJobTimeLayer() {
  const { store } = useGame();
  const jobs = store.current.value?.state.roadJobs ?? [];
  const scale = store.view.value?.scale ?? 1;
  if (jobs.length === 0 || scale < JOB_TIME_MIN_PX) return null;
  const fontSize = JOB_TIME_PX / scale;
  return (
    <g class="road-job-times">
      {jobs.map((job) => (
        <text
          key={job.id}
          class="map-text road-job-time"
          x={job.x + 0.5}
          y={job.y - 0.04}
          font-size={fontSize}
          stroke-width={fontSize * 0.28}
          fill={COLORS.road}
          text-anchor="middle"
        >
          {duration(job.remainingSeconds)}
        </text>
      ))}
    </g>
  );
}
