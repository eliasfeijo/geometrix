// A fake clock for the lab's timers: time moves only with advance(), which
// runs the timers due, in time order (then in the order they were set).

export class FakeClock {
  private time = 0;
  private nextId = 1;
  private timers: { id: number; at: number; fn: () => void }[] = [];

  now = (): number => this.time;

  set = (fn: () => void, ms: number): unknown => {
    const id = this.nextId++;
    this.timers.push({ id, at: this.time + Math.max(0, ms), fn });
    return id;
  };

  clear = (handle: unknown): void => {
    this.timers = this.timers.filter((t) => t.id !== handle);
  };

  /** Moves time forward by `ms`, running every timer due on the way. */
  advance(ms: number): void {
    const end = this.time + ms;
    for (;;) {
      const due = this.timers
        .filter((t) => t.at <= end)
        .sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (due === undefined) break;
      this.timers = this.timers.filter((t) => t !== due);
      this.time = Math.max(this.time, due.at);
      due.fn();
    }
    this.time = end;
  }

  get pending(): number {
    return this.timers.length;
  }
}
