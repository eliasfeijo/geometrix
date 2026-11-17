// The simulated network between the lab's page and its worker (spec D17,
// L-3, L-4; plan P7). Each leg delays every message by half the chosen RTT,
// plus or minus a jitter of up to 20% of that, and keeps the order: a
// message never overtakes the one before it, as on a WebSocket over TCP. A
// new RTT holds from the next message on (L-4).

export type Scheduler = {
  now(): number;
  set(fn: () => void, ms: number): unknown;
};

/** The RTTs of the lab's selector, in ms (spec D17). */
export const RTT_CHOICES = [0, 50, 100, 150, 200, 300] as const;

/** The jitter of each leg, in per mille of its delay (spec section 6). */
export const JITTER_PERMILLE = 200;

export class DelayedChannel<T> {
  /** Round trip time in ms; each leg takes half. */
  rttMs = 0;
  private readonly queue: { at: number; message: T }[] = [];
  private lastAt = Number.NEGATIVE_INFINITY;
  private armed = false;
  private readonly deliver: (message: T) => void;
  private readonly scheduler: Scheduler;
  private readonly random: () => number;

  constructor(
    deliver: (message: T) => void,
    scheduler: Scheduler,
    random: () => number = Math.random,
  ) {
    this.deliver = deliver;
    this.scheduler = scheduler;
    this.random = random;
  }

  /** The delay of one leg now: RTT ÷ 2 ± the jitter, never negative. */
  legDelay(): number {
    const leg = this.rttMs / 2;
    const jitter = ((leg * JITTER_PERMILLE) / 1000) * (2 * this.random() - 1);
    return Math.max(0, leg + jitter);
  }

  send(message: T): void {
    const now = this.scheduler.now();
    // Never before the previous message: the order is kept.
    const at = Math.max(now + this.legDelay(), this.lastAt);
    this.lastAt = at;
    if (this.queue.length === 0 && at <= now) {
      this.deliver(message);
      return;
    }
    this.queue.push({ at, message });
    this.arm();
  }

  /** Messages still on their way. */
  get inFlight(): number {
    return this.queue.length;
  }

  private arm(): void {
    if (this.armed || this.queue.length === 0) return;
    this.armed = true;
    const wait = Math.max(0, this.queue[0]!.at - this.scheduler.now());
    this.scheduler.set(() => this.flush(), wait);
  }

  private flush(): void {
    this.armed = false;
    const now = this.scheduler.now();
    while (this.queue.length > 0 && this.queue[0]!.at <= now) {
      this.deliver(this.queue.shift()!.message);
    }
    this.arm();
  }
}
