#!/usr/bin/env bash

set -euo pipefail

# NOTES
# - Best run via npm scripts:
#     - npm run deploy:beta
#     - npm run deploy:master
# - Default behavior includes hard reset to origin/<branch>.
# - pm2 is configured in ./ecosystem.config.cjs

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

log() {
  echo "[$(date -Iseconds)] $1"
}

fail() {
  echo "[$(date -Iseconds)] FAILURE deploy.sh $1" >&2
  exit 1
}

on_err() {
  local exit_code="$?"
  fail "unexpected error at line ${BASH_LINENO[0]} (exit ${exit_code})"
}
trap on_err ERR

usage() {
  echo "Usage: bash ./tools/deploy.sh <beta|master>" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

wait_for_pm2_online() {
  local app_name="$1"
  local max_attempts="$2"
  local sleep_seconds="$3"
  local attempt=1

  while [[ "${attempt}" -le "${max_attempts}" ]]; do
    if pm2 describe "${app_name}" 2>/dev/null | grep -Eq 'status\s+online'; then
      log "PM2 process ${app_name} is online"
      return 0
    fi
    log "waiting for PM2 process ${app_name} to become online (attempt ${attempt}/${max_attempts})"
    sleep "${sleep_seconds}"
    attempt=$((attempt + 1))
  done

  fail "PM2 process ${app_name} did not become online"
}

wait_for_http_health() {
  local url="$1"
  local timeout_seconds="$2"
  local interval_seconds="$3"
  local elapsed=0

  require_cmd curl

  while [[ "${elapsed}" -lt "${timeout_seconds}" ]]; do
    if curl --silent --show-error --fail --max-time 10 "${url}" >/dev/null; then
      log "HTTP health check passed at ${url}"
      return 0
    fi
    log "waiting for HTTP health at ${url} (${elapsed}/${timeout_seconds}s)"
    sleep "${interval_seconds}"
    elapsed=$((elapsed + interval_seconds))
  done

  fail "HTTP health check failed at ${url} after ${timeout_seconds}s"
}

if [[ $# -lt 1 || $# -gt 2 ]]; then
  usage
fi

TARGET_BRANCH="$1"
if [[ $# -eq 2 ]]; then
  if [[ "$2" != "--force-reset" ]]; then
    usage
  fi
fi

if [[ "${TARGET_BRANCH}" != "beta" && "${TARGET_BRANCH}" != "master" ]]; then
  usage
fi

require_cmd npm
require_cmd pm2

NVM_SCRIPT="${NVM_DIR:-$HOME/.nvm}/nvm.sh"
if [[ ! -s "${NVM_SCRIPT}" ]]; then
  fail "nvm script not found at ${NVM_SCRIPT}"
fi

# shellcheck disable=SC1090
. "${NVM_SCRIPT}"
nvm use

cd "${REPO_ROOT}"

# Reuse the git-only sync workflow to avoid duplicating branch/reset logic.
bash "${SCRIPT_DIR}/pull.sh" "${TARGET_BRANCH}"

if [[ ! -f .env ]]; then
  fail ".env not found in ${REPO_ROOT}"
fi

# Export .env variables for health-check settings and any deploy-time config.
set -a
# shellcheck disable=SC1091
source .env
set +a

HEALTHCHECK_TIMEOUT_SEC="${HEALTHCHECK_TIMEOUT_SEC:-120}"
HEALTHCHECK_INTERVAL_SEC="${HEALTHCHECK_INTERVAL_SEC:-5}"

if [[ "${TARGET_BRANCH}" = "beta" ]]; then
  HEALTHCHECK_URL="${HEALTHCHECK_URL_BETA:-${HEALTHCHECK_URL:-}}"
else
  HEALTHCHECK_URL="${HEALTHCHECK_URL_MASTER:-${HEALTHCHECK_URL:-}}"
fi

if [[ -z "${HEALTHCHECK_URL}" ]]; then
  fail "HEALTHCHECK_URL is required (set HEALTHCHECK_URL, or HEALTHCHECK_URL_BETA / HEALTHCHECK_URL_MASTER)"
fi

if ! compgen -G "${REPO_ROOT}/env/environment.*" >/dev/null; then
  fail "no files matched ${REPO_ROOT}/env/environment.*"
fi

mkdir -p "${REPO_ROOT}/src/environments"
cp -v "${REPO_ROOT}"/env/environment.* "${REPO_ROOT}/src/environments/"

# If beta, copy any new assets to prod folder so they can be tested on beta site.
if [[ "${TARGET_BRANCH}" = "beta" ]]; then
  mkdir -p "${REPO_ROOT}/dist/prod/browser/assets"
  cp -rnv "${REPO_ROOT}/src/assets/." "${REPO_ROOT}/dist/prod/browser/assets/"
fi

if [[ -f "${REPO_ROOT}/package-lock.json" ]]; then
  npm ci
else
  npm install
fi

npm run "build:${TARGET_BRANCH}"

pm2 restart "snorkelology_${TARGET_BRANCH}"
pm2 save

wait_for_pm2_online "snorkelology_${TARGET_BRANCH}" "10" "3"
wait_for_http_health "${HEALTHCHECK_URL}" "${HEALTHCHECK_TIMEOUT_SEC}" "${HEALTHCHECK_INTERVAL_SEC}"

log "SUCCESS deploy.sh deploy complete for branch ${TARGET_BRANCH}"
