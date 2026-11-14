// What the network panel shows (M1.5 spec D8, plan section 6): counters the
// connection and the store bump as messages come and go. Plain fields, read
// by the panel on its own clock.

/** Why a welcome came: opening the page, a reconnect the buffer could not resume, or a resync. */
export type WelcomeCause = "join" | "reconnect" | "resync";

/** Window of the bytes-per-second average. */
export const BYTES_WINDOW_MS = 10_000;

export class NetStats {
  /** Seq of the last delta applied (or of the last welcome). */
  seq = 0;
  deltas = 0;
  /** Reconnects that went on from the buffer, without a welcome. */
  resumes = 0;
  readonly welcomes: Record<WelcomeCause, number> = {
    join: 0,
    reconnect: 0,
    resync: 0,
  };
  readonly resyncs = { seqGap: 0, hashMismatch: 0 };
  readonly hashes = { ok: 0, mismatch: 0 };
  totalBytes = 0;
  private samples: { at: number; bytes: number }[] = [];

  received(bytes: number, now: number): void {
    this.totalBytes += bytes;
    this.samples.push({ at: now, bytes });
    this.forget(now);
  }

  /** Average over the last BYTES_WINDOW_MS. */
  bytesPerSecond(now: number): number {
    this.forget(now);
    let sum = 0;
    for (const s of this.samples) sum += s.bytes;
    return (sum * 1000) / BYTES_WINDOW_MS;
  }

  private forget(now: number): void {
    const keep = this.samples.findIndex((s) => now - s.at < BYTES_WINDOW_MS);
    if (keep < 0) this.samples = [];
    else if (keep > 0) this.samples = this.samples.slice(keep);
  }
}
