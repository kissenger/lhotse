#!/usr/bin/env bash

set -euo pipefail

# Git-only sync helper (no build, no PM2 restart).
# Usage:
#   bash ./tools/pull.sh [beta|master]
# Examples:
#   npm run pull
#   npm run pull -- beta
#   npm run pull:beta

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

log() {
  echo "[$(date -Iseconds)] $1"
}

fail() {
  echo "[$(date -Iseconds)] FAILURE pull.sh $1" >&2
  exit 1
}

usage() {
  echo "Usage: bash ./tools/pull.sh [beta|master]" >&2
  exit 1
}

if [[ $# -gt 2 ]]; then
  usage
fi

TARGET_BRANCH="${1:-}"
FORCE_RESET=1

if [[ $# -ge 1 && "${1}" = "--force-reset" ]]; then
  TARGET_BRANCH=""
fi

if [[ $# -eq 2 ]]; then
  if [[ "${2}" != "--force-reset" ]]; then
    usage
  fi
  FORCE_RESET=1
fi

cd "${REPO_ROOT}"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "${REPO_ROOT} is not a git repository"

if [[ -z "${TARGET_BRANCH}" ]]; then
  TARGET_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
fi

if [[ "${TARGET_BRANCH}" != "beta" && "${TARGET_BRANCH}" != "master" ]]; then
  fail "target branch must be beta or master (got: ${TARGET_BRANCH})"
fi

if [[ -n "$(git status --porcelain)" ]]; then
  log "local changes detected; they will be discarded by default hard reset"
fi

log "syncing branch ${TARGET_BRANCH}"
git fetch --all
git checkout "${TARGET_BRANCH}"

git reset --hard "origin/${TARGET_BRANCH}"
log "hard reset to origin/${TARGET_BRANCH} complete"

log "SUCCESS pull.sh git sync complete for ${TARGET_BRANCH}"
