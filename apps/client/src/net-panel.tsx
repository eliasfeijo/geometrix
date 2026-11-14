// The network panel (M1.5 spec D8): with ?net=1 in the URL, a corner of the
// screen tells what the team stream is doing, to check it without DevTools.
// Not game UI: small text, no interaction.

import { useEffect, useState } from "preact/hooks";
import { BYTES_WINDOW_MS, type NetStats } from "./net-stats.ts";

const REFRESH_MS = 1000;

export function showNetPanel(location: Pick<Location, "search">): boolean {
  return new URLSearchParams(location.search).get("net") === "1";
}

export function NetPanel({ stats }: { stats: NetStats }) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(performance.now()),
      REFRESH_MS,
    );
    return () => window.clearInterval(timer);
  }, []);
  return <NetLines stats={stats} now={now} />;
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
    <dl class="net-panel" aria-label="Rede">
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
