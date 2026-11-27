#!/usr/bin/env bash
# Waits for a background Claude session to change state (the run-wave
# skill). Run it in the background from the orchestrator session:
#
#   scripts/watch-lane.sh <session-id> [state]
#
# Polls `claude agents --json --all` every 120 s and exits when the
# session's state is no longer [state] (default: working), printing the new
# state (working, blocked: waiting for the owner, done, stopped, gone).

set -uo pipefail

[[ $# -ge 1 ]] || {
  echo "usage: scripts/watch-lane.sh <session-id> [state]" >&2
  exit 2
}
id=$1
from=${2:-working}

state() {
  claude agents --json --all 2>/dev/null | node -e '
    let s = "";
    process.stdin.on("data", (c) => (s += c)).on("end", () => {
      const a = JSON.parse(s || "[]").find((x) => x.id === process.argv[1]);
      console.log(a ? (a.state ?? "?") : "gone");
    });' "$id"
}

sleep 60
while true; do
  now=$(state)
  if [[ $now != "$from" ]]; then
    echo "$(date +%H:%M) $id state=$now"
    exit 0
  fi
  sleep 120
done
