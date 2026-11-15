import { createHash, type Hash } from "node:crypto";
import {
  canonicalJson,
  serialize,
  type SimEvent,
  type WorldState,
} from "@geometrix/sim";

/** sha256 of the canonical serialization (plan section 3). */
export function stateHash(state: WorldState): string {
  return createHash("sha256").update(serialize(state)).digest("hex");
}

/**
 * sha256 of a run's events, fed tick by tick (ADR-0007): one canonical JSON
 * line per event, audience included, so the same events in the same order
 * give the same hash however the run was split.
 */
export class EventHash {
  private readonly hash: Hash = createHash("sha256");
  count = 0;

  add(events: readonly SimEvent[]): void {
    for (const event of events) {
      this.hash.update(`${canonicalJson(event)}\n`);
      this.count += 1;
    }
  }

  digest(): string {
    return this.hash.copy().digest("hex");
  }
}
