// The measured delay between a key and its effect on the screen (spec L-4,
// section 7; plan section 13). The page stamps each input with its local
// clock; the frame of the tick that applied it says so, and the effect is on
// the screen when that frame is drawn, or one tick later with the
// interpolation (the creep glides there over one tick). Expected: about the
// RTT plus up to one tick, plus the jitter, with no build-up over a battle.

export type LatencySummary = {
  samples: number;
  medianMs: number;
  p95Ms: number;
};

/** The value at quantile q (0..1) of an ascending list, by nearest rank. */
export function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return Number.NaN;
  const rank = Math.ceil(q * sorted.length) - 1;
  return sorted[Math.min(Math.max(rank, 0), sorted.length - 1)]!;
}

export class LatencyMeter {
  private readonly sentAt = new Map<number, number>();
  private samples: number[] = [];

  sent(seq: number, at: number): void {
    this.sentAt.set(seq, at);
  }

  /** The inputs `seqs` show on the screen at `at`. */
  shown(seqs: readonly number[], at: number): void {
    for (const seq of seqs) {
      const sent = this.sentAt.get(seq);
      if (sent === undefined) continue;
      this.sentAt.delete(seq);
      this.samples.push(at - sent);
    }
  }

  /** A new battle: the delays of the last one no longer count. */
  reset(): void {
    this.sentAt.clear();
    this.samples = [];
  }

  /** The delays measured so far, in order. */
  get all(): readonly number[] {
    return this.samples;
  }

  summary(): LatencySummary {
    const sorted = [...this.samples].sort((a, b) => a - b);
    return {
      samples: sorted.length,
      medianMs: quantile(sorted, 0.5),
      p95Ms: quantile(sorted, 0.95),
    };
  }
}

/** Average size of what crosses the channel, in bytes (spec D17, plan P6). */
export class SizeMeter {
  private total = 0;
  private count = 0;
  private readonly encoder = new TextEncoder();

  add(message: unknown): void {
    this.total += this.encoder.encode(JSON.stringify(message)).length;
    this.count += 1;
  }

  reset(): void {
    this.total = 0;
    this.count = 0;
  }

  get averageBytes(): number {
    return this.count === 0 ? Number.NaN : this.total / this.count;
  }
}
