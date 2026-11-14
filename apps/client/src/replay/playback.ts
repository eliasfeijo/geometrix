// Replay speed (plan section 8, F8 details): world seconds per real second,
// or as fast as the browser can simulate. Each animation frame turns the real
// time since the last one into ticks; the fraction of a tick carries over.

export const SPEEDS = [1, 60, 600, 3600, "max"] as const;
export type Speed = (typeof SPEEDS)[number];

/** Real time a frame may spend simulating, so the page keeps drawing. */
export const FRAME_BUDGET_MS = 12;

/**
 * Longest real time a frame accounts for: after a stall (a background tab, a
 * long seek) the replay goes on instead of catching up in one burst.
 */
export const MAX_FRAME_MS = 250;

/** How the rate is measured for the screen: over this much real time. */
export const RATE_WINDOW_MS = 1000;

/**
 * Ticks due after `elapsedMs` of real time at `speed`, plus the fraction of
 * a tick left over. "max" is unbounded: the frame budget limits it.
 */
export function dueTicks(
  speed: Speed,
  elapsedMs: number,
  tickSeconds: number,
  carry: number,
): { ticks: number; carry: number } {
  if (speed === "max") return { ticks: Infinity, carry: 0 };
  const exact =
    carry + (Math.min(elapsedMs, MAX_FRAME_MS) * speed) / (1000 * tickSeconds);
  const ticks = Math.floor(exact);
  return { ticks, carry: exact - ticks };
}

/** Ticks per real second over a sliding window of frames. */
export class RateMeter {
  private samples: { at: number; ticks: number }[] = [];

  add(at: number, ticks: number): void {
    this.samples.push({ at, ticks });
    while (
      this.samples.length > 0 &&
      at - this.samples[0]!.at > RATE_WINDOW_MS
    ) {
      this.samples.shift();
    }
  }

  /** Ticks per second in the window, or null with too little to tell. */
  rate(now: number): number | null {
    const recent = this.samples.filter((s) => now - s.at <= RATE_WINDOW_MS);
    if (recent.length < 2) return null;
    const span = now - recent[0]!.at;
    if (span <= 0) return null;
    const ticks = recent.slice(1).reduce((sum, s) => sum + s.ticks, 0);
    return (ticks * 1000) / span;
  }

  reset(): void {
    this.samples = [];
  }
}
