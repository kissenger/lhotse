#!/usr/bin/env bash

set -euo pipefail

# Git-only sync helper (no build, no PM2 restart).
# Usage:
#   bash ./tools/pull.sh [beta|master]
# Examples:
#   npm run pull
#   npm run pull -- beta
#   npm run pull:beta

SNORKELOLOGY_ROOT="${HOME}/snorkelology"
TARGET_REPO_ROOT=""

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

if [[ -z "${TARGET_BRANCH}" ]]; then
  fail "branch argument required: beta or master"
fi

if [[ -z "${TARGET_REPO_ROOT}" ]]; then
  TARGET_REPO_ROOT="${SNORKELOLOGY_ROOT}/${TARGET_BRANCH}"
fi

ORIGIN_URL="$(git -C "${TARGET_REPO_ROOT}" remote get-url origin 2>/dev/null || true)"

if [[ -z "${ORIGIN_URL}" ]]; then
  fail "origin remote not configured in ${TARGET_REPO_ROOT}; ensure ${TARGET_REPO_ROOT} is a git checkout"
fi

ensure_target_checkout() {
  local target_root="$1"
  local branch="$2"

  mkdir -p "$(dirname -- "${target_root}")"
  git -C "${target_root}" fetch origin "${branch}" 2>/dev/null || true

  if [[ -d "${target_root}/.git" || -f "${target_root}/.git" ]]; then
    git -C "${target_root}" rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "${target_root} exists but is not a git checkout"
    git -C "${target_root}" remote set-url origin "${ORIGIN_URL}"
    return 0
  fi

  if [[ -e "${target_root}" && -n "$(find "${target_root}" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]]; then
    fail "target repo root ${target_root} exists and is not empty"
  fi

  log "creating branch checkout for ${branch} at ${target_root}"
  git clone --branch "${branch}" --single-branch "${ORIGIN_URL}" "${target_root}"
}

sync_checkout() {
  local target_root="$1"
  local branch="$2"

  log "syncing branch ${branch} in ${target_root}"

  git -C "${target_root}" fetch origin "${branch}"
  git -C "${target_root}" remote set-url origin "${ORIGIN_URL}"
  git -C "${target_root}" fetch origin "${branch}"
  git -C "${target_root}" checkout -B "${branch}" "origin/${branch}"

  git -C "${target_root}" reset --hard "origin/${branch}"
  git -C "${target_root}" clean -fd
}

ensure_target_checkout "${TARGET_REPO_ROOT}" "${TARGET_BRANCH}"
sync_checkout "${TARGET_REPO_ROOT}" "${TARGET_BRANCH}"
log "hard reset to origin/${TARGET_BRANCH} complete in ${TARGET_REPO_ROOT}"

log "SUCCESS pull.sh git sync complete for ${TARGET_BRANCH}"
