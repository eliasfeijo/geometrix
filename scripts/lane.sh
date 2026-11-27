#!/usr/bin/env bash
# Starts a phase lane: a git worktree from main and a background Claude
# session in it (the run-wave skill, docs/HARNESS.md "Running a wave").
#
#   scripts/lane.sh <worktree-dir> <branch> <model> <name> <prompt-file>
#
# Creates <worktree-dir> on a new <branch> from main (or reuses it when it
# already exists on that branch), runs npm ci there, and starts
# `claude --bg --model <model> --permission-mode auto -n <name>` with the
# prompt file's text. Prints the session id for `claude attach <id>` and
# scripts/watch-lane.sh. It never merges or pushes.

set -euo pipefail

[[ $# -eq 5 ]] || {
  echo "usage: scripts/lane.sh <worktree-dir> <branch> <model> <name> <prompt-file>" >&2
  exit 2
}
dir=$1
branch=$2
model=$3
name=$4
prompt=$(cat "$5")

if [[ -d $dir ]]; then
  current=$(git -C "$dir" branch --show-current)
  [[ $current == "$branch" ]] || {
    echo "lane: $dir exists on $current, not $branch" >&2
    exit 1
  }
else
  git worktree add "$dir" -b "$branch" main
fi

cd "$dir"
echo "[lane] npm ci in $dir"
npm ci --prefer-offline --no-audit --no-fund >/dev/null
claude --bg --model "$model" --permission-mode auto -n "$name" "$prompt"
