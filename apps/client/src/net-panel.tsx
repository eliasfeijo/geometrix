// The network panel (M1.5 spec D8): with ?net=1 in the URL, a corner of the
// screen tells what the team stream is doing, to check it without DevTools.
// Not game UI: small text. Its one control is the battle screen's movement
// drawing (junction D19), the lab's four options, until PLAYTEST group 7 and
// P choose one; with it, the battle inputs' round trip.

import type { Signal } from "@preact/signals";
import { useEffect, useState } from "preact/hooks";
import {
  MOTION_LABELS,
  MOTION_MODES,
  type MotionMode,
} from "./battle/motion.ts";
import { BYTES_WINDOW_MS, type NetStats } from "./net-stats.ts";

const REFRESH_MS = 1000;

export function showNetPanel(location: Pick<Location, "search">): boolean {
  return new URLSearchParams(location.search).get("net") === "1";
}

/** `search` with the ?net=1 of `current` kept: the panel survives navigation. */
export function keepNetPanel(search: string, current: string): string {
  if (!showNetPanel({ search: current })) return search;
  const params = new URLSearchParams(search);
  params.set("net", "1");
  return `?${params.toString()}`;
}

export function NetPanel(props: {
  stats: NetStats;
  motion: Signal<MotionMode>;
  /** The battle inputs' round trip (ms), 0 before the first one. */
  battleRttMs(): number;
}) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(performance.now()),
      REFRESH_MS,
    );
    return () => window.clearInterval(timer);
  }, []);
  const { stats, motion } = props;
  const rtt = props.battleRttMs();
  return (
    <div class="net-panel" aria-label="Rede">
      <NetLines stats={stats} now={now} />
      <dl>
        <div>
          <dt>batalha</dt>
          <dd>{rtt === 0 ? "—" : `ida e volta ${Math.round(rtt)} ms`}</dd>
        </div>
        <div>
          <dt>movimento</dt>
          <dd>
            <select
              value={motion.value}
              title="Como a tela de batalha desenha os creeps andando (D19)"
              onChange={(e) => {
                motion.value = e.currentTarget.value as MotionMode;
                // The battle keeps the arrows, not the select.
                e.currentTarget.blur();
              }}
            >
              {MOTION_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {MOTION_LABELS[mode]}
                </option>
              ))}
            </select>
          </dd>
        </div>
      </dl>
    </div>
  );
}

/** The panel's text at `now`; separate from the clock for tests. */
export function NetLines({ stats, now }: { stats: NetStats; now: number }) {
  const { welcomes, resyncs, hashes } = stats;
  const rows: [string, string][] = [
    [
      "recebido",
      `${kilobytes(stats.bytesPerSecond(now))} KB/s (${BYTES_WINDOW_MS / 1000} s)`,
    ],
    ["seq", String(stats.seq)],
    ["deltas", String(stats.deltas)],
    ["retomadas", String(stats.resumes)],
    [
      "welcome",
      `entrada ${welcomes.join} · reconexão ${welcomes.reconnect} · resync ${welcomes.resync}`,
    ],
    ["resync", `seq ${resyncs.seqGap} · hash ${resyncs.hashMismatch}`],
    ["hash", `✓ ${hashes.ok} · ✗ ${hashes.mismatch}`],
  ];
  return (
    <dl>
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd class={label === "hash" && hashes.mismatch > 0 ? "bad" : ""}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function kilobytes(bytes: number): string {
  return (bytes / 1024).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
