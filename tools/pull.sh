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
CANONICAL_REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
TARGET_REPO_ROOT="${CANONICAL_REPO_ROOT}"

log() {
  echo "[$(date -Iseconds)] $1"
}

fail() {
  echo "[$(date -Iseconds)] FAILURE pull.sh $1" >&2
  exit 1
}

usage() {
  echo "Usage: bash ./tools/pull.sh [beta|master] [--repo-root <path>] [--force-reset]" >&2
  exit 1
}

TARGET_BRANCH=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    beta|master)
      if [[ -n "${TARGET_BRANCH}" ]]; then
        usage
      fi
      TARGET_BRANCH="$1"
      shift
      ;;
    --repo-root)
      [[ $# -ge 2 ]] || usage
      TARGET_REPO_ROOT="$2"
      shift 2
      ;;
    --force-reset)
      shift
      ;;
    *)
      usage
      ;;
  esac
done

git -C "${CANONICAL_REPO_ROOT}" rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "${CANONICAL_REPO_ROOT} is not a git repository"

if [[ -z "${TARGET_BRANCH}" ]]; then
  TARGET_BRANCH="$(git -C "${CANONICAL_REPO_ROOT}" rev-parse --abbrev-ref HEAD)"
fi

if [[ "${TARGET_BRANCH}" != "beta" && "${TARGET_BRANCH}" != "master" ]]; then
  fail "target branch must be beta or master (got: ${TARGET_BRANCH})"
fi

ensure_target_checkout() {
  local target_root="$1"
  local branch="$2"

  if [[ "${target_root}" = "${CANONICAL_REPO_ROOT}" ]]; then
    if [[ -n "$(git -C "${target_root}" status --porcelain)" ]]; then
      log "local changes detected in ${target_root}; they will be discarded by hard reset"
    fi
    return 0
  fi

  mkdir -p "$(dirname -- "${target_root}")"
  git -C "${CANONICAL_REPO_ROOT}" fetch origin "${branch}"

  if [[ -d "${target_root}/.git" || -f "${target_root}/.git" ]]; then
    git -C "${target_root}" rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "${target_root} exists but is not a git checkout"
    return 0
  fi

  if [[ -e "${target_root}" && -n "$(find "${target_root}" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]]; then
    fail "target repo root ${target_root} exists and is not empty"
  fi

  log "creating branch checkout for ${branch} at ${target_root}"
  git clone --branch "${branch}" --single-branch "${CANONICAL_REPO_ROOT}" "${target_root}"
}

sync_checkout() {
  local target_root="$1"
  local branch="$2"

  log "syncing branch ${branch} in ${target_root}"

  if [[ "${target_root}" = "${CANONICAL_REPO_ROOT}" ]]; then
    git -C "${target_root}" fetch origin "${branch}"
    git -C "${target_root}" checkout "${branch}"
  else
    git -C "${CANONICAL_REPO_ROOT}" fetch origin "${branch}"
    git -C "${target_root}" fetch origin "${branch}"
    git -C "${target_root}" checkout -B "${branch}" "origin/${branch}"
  fi

  git -C "${target_root}" reset --hard "origin/${branch}"
  git -C "${target_root}" clean -fd
}

ensure_target_checkout "${TARGET_REPO_ROOT}" "${TARGET_BRANCH}"
sync_checkout "${TARGET_REPO_ROOT}" "${TARGET_BRANCH}"
log "hard reset to origin/${TARGET_BRANCH} complete in ${TARGET_REPO_ROOT}"

log "SUCCESS pull.sh git sync complete for ${TARGET_BRANCH}"
