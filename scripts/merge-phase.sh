#!/usr/bin/env bash
# Merges a phase or docs branch into main, in the checkout that holds main
# (the integration checkout, CLAUDE.local.md; the `commit` skill's rules).
#
# A session isolated in a worktree cannot run git in that checkout: it
# writes the merge message to a file and ends with one line for the owner
# to paste into their own terminal, from any checkout of the repository
# (not with the session's `!` prefix: that runs through the worktree guard,
# which refuses git in another checkout, and the merge fails silently):
#
#   scripts/merge-phase.sh <branch> <message-file> [--no-check] [--cleanup]
#
# Steps, each timed: checks (main checked out and clean, the branch exists
# and has commits main lacks), `git merge --no-ff -F <message-file>`,
# `npm run check` in the integration checkout (skip with --no-check, e.g. a
# docs-only branch), main..branch empty, and with --cleanup the branch's
# worktree removed and the branch deleted. A conflict stops the script with
# the merge in progress, for the owner to resolve or `git merge --abort`.
# It never pushes: the owner pushes main (CLAUDE.local.md).

set -euo pipefail

usage() {
  echo "usage: scripts/merge-phase.sh <branch> <message-file> [--no-check] [--cleanup]" >&2
  exit 2
}

[[ $# -ge 2 ]] || usage
branch=$1
message=$2
shift 2
check=1
cleanup=0
for option in "$@"; do
  case $option in
    --no-check) check=0 ;;
    --cleanup) cleanup=1 ;;
    *) usage ;;
  esac
done

started=$SECONDS
step() {
  echo "[merge-phase] $1 ($((SECONDS - started)) s)"
}

[[ -f $message ]] || { echo "no message file: $message" >&2; exit 2; }

# The integration checkout is the repository's main worktree: the first one
# `git worktree list` prints.
main_dir=$(git worktree list --porcelain | awk '/^worktree /{print $2; exit}')
current=$(git -C "$main_dir" symbolic-ref --quiet --short HEAD || true)
if [[ $current != main ]]; then
  echo "$main_dir is on '$current', not main" >&2
  exit 1
fi
if [[ -n $(git -C "$main_dir" status --porcelain --untracked-files=no) ]]; then
  echo "$main_dir has uncommitted changes: commit or set them aside first" >&2
  exit 1
fi
git -C "$main_dir" rev-parse --verify --quiet "refs/heads/$branch" > /dev/null ||
  { echo "no branch $branch" >&2; exit 1; }
ahead=$(git -C "$main_dir" rev-list --count "main..$branch")
if [[ $ahead -eq 0 ]]; then
  echo "$branch has nothing main lacks: already merged" >&2
  exit 1
fi
step "checks passed: $branch is $ahead commits ahead of main in $main_dir"

git -C "$main_dir" merge --no-ff "$branch" -F "$message"
step "merged"

if [[ $check -eq 1 ]]; then
  (cd "$main_dir" && npm run check)
  step "npm run check green on main"
fi

left=$(git -C "$main_dir" rev-list --count "main..$branch")
[[ $left -eq 0 ]] || { echo "main..$branch still has $left commits" >&2; exit 1; }
step "main..$branch is empty"

if [[ $cleanup -eq 1 ]]; then
  worktree=$(git worktree list --porcelain |
    awk -v ref="refs/heads/$branch" '/^worktree /{path=$2} $0 == "branch " ref {print path}')
  if [[ -n $worktree ]]; then
    case $PWD/ in
      "$worktree"/*)
        echo "this shell is inside $worktree: remove it from elsewhere:" >&2
        echo "  git worktree remove $worktree && git branch -d $branch" >&2
        exit 1
        ;;
    esac
    git -C "$main_dir" worktree remove "$worktree"
    step "worktree $worktree removed"
  fi
  git -C "$main_dir" branch -d "$branch"
  step "branch $branch deleted"
fi

echo "[merge-phase] done in $((SECONDS - started)) s. Push from PowerShell: git push origin main"
