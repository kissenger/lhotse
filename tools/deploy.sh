#!/usr/bin/env bash

unset npm_config_prefix
echo "npm_config_prefix after unset: $npm_config_prefix"

set -euo pipefail

# NOTES
# - Best run via npm scripts:
#     - npm run deploy:beta
#     - npm run deploy:master
# - Default behavior includes hard reset to origin/<branch>.
# - pm2 is configured in ./ecosystem.config.cjs

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CANONICAL_REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

resolve_deploy_root() {
  local branch="$1"
  echo "${CANONICAL_REPO_ROOT}/${branch}"
}

sync_local_deploy_files() {
  local source_root="$1"
  local target_root="$2"

  if [[ "${source_root}" = "${target_root}" ]]; then
    return 0
  fi

  if [[ ! -f "${source_root}/.env" ]]; then
    fail ".env not found in ${source_root}"
  fi

  if [[ ! -d "${source_root}/env" ]]; then
    fail "env directory not found in ${source_root}"
  fi

  cp -f "${source_root}/.env" "${target_root}/.env"
  mkdir -p "${target_root}/env"
  cp -f "${source_root}"/env/environment.* "${target_root}/env/"
}

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

run_angular_build() {
  local branch="$1"
  local node_mem_mb="$2"
  local max_workers="$3"
  local disable_source_map="$4"

  local -a npm_cmd=(npm run "build:${branch}")
  if [[ "${disable_source_map}" = "true" ]]; then
    npm_cmd+=(-- --source-map=false)
  fi

  log "Build settings: NODE_OPTIONS=--max-old-space-size=${node_mem_mb}, NG_BUILD_MAX_WORKERS=${max_workers}, disableSourceMap=${disable_source_map}"
  NODE_OPTIONS="--max-old-space-size=${node_mem_mb}" \
    NG_BUILD_MAX_WORKERS="${max_workers}" \
    "${npm_cmd[@]}"
}

wait_for_pm2_online() {
  local app_name="$1"
  local max_attempts="$2"
  local sleep_seconds="$3"
  local attempt=1

  while [[ "${attempt}" -le "${max_attempts}" ]]; do
    local status_line
    status_line=$(pm2 describe "${app_name}" 2>/dev/null | grep -E 'status\\s+')
    log "PM2 status line: $status_line"
    if echo "$status_line" | grep -Eq 'online|running'; then
      log "PM2 process ${app_name} is online/running"
      return 0
    fi
    log "waiting for PM2 process ${app_name} to become online/running (attempt ${attempt}/${max_attempts})"
    sleep "${sleep_seconds}"
    attempt=$((attempt + 1))
  done
  log "Final PM2 describe output:"
  pm2 describe "${app_name}"
  fail "PM2 process ${app_name} did not become online/running"
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

DEPLOY_ROOT="$(resolve_deploy_root "${TARGET_BRANCH}")"

NVM_SCRIPT="${NVM_DIR:-$HOME/.nvm}/nvm.sh"
if [[ ! -s "${NVM_SCRIPT}" ]]; then
  fail "nvm script not found at ${NVM_SCRIPT}"
fi

# shellcheck disable=SC1090
. "${NVM_SCRIPT}"
nvm use

cd "${CANONICAL_REPO_ROOT}"

# Reuse the git-only sync workflow to avoid duplicating branch/reset logic.
bash "${SCRIPT_DIR}/pull.sh" "${TARGET_BRANCH}" --repo-root "${DEPLOY_ROOT}"
log "deploying from isolated checkout at ${DEPLOY_ROOT}"

sync_local_deploy_files "${CANONICAL_REPO_ROOT}" "${DEPLOY_ROOT}"

cd "${DEPLOY_ROOT}"

if [[ ! -f .env ]]; then
  fail ".env not found in ${DEPLOY_ROOT}"
fi

# Export .env variables for deploy-time config.
set -a
# shellcheck disable=SC1091
source .env
set +a

HEALTHCHECK_TIMEOUT_SEC="120"
HEALTHCHECK_INTERVAL_SEC="5"

if [[ "${TARGET_BRANCH}" = "beta" ]]; then
  HEALTHCHECK_URL="http://127.0.0.1:4001/health"
else
  HEALTHCHECK_URL="http://127.0.0.1:4000/health"
fi

if ! compgen -G "${DEPLOY_ROOT}/env/environment.*" >/dev/null; then
  fail "no files matched ${DEPLOY_ROOT}/env/environment.*"
fi

mkdir -p "${DEPLOY_ROOT}/src/environments"
cp -v "${DEPLOY_ROOT}"/env/environment.* "${DEPLOY_ROOT}/src/environments/"

COMMIT_INFO="$(git -C "${DEPLOY_ROOT}" log -1 --date=iso-strict --pretty=format:'%ad | %s')"
echo -e "\033[31m[$(date -Iseconds)] Deploying: ${COMMIT_INFO}\033[0m"

# Always use npm install for faster deployment
log "Running: npm install"
npm install

log "Running: npm run build:${TARGET_BRANCH}"
# Keep defaults conservative for low-memory servers and retry once on OOM kill.
BUILD_NODE_MEMORY_MB="${NODE_BUILD_MEMORY_MB:-512}"
BUILD_MAX_WORKERS="${NG_BUILD_MAX_WORKERS:-2}"
BUILD_DISABLE_SOURCE_MAP="${BUILD_DISABLE_SOURCE_MAP:-true}"

if run_angular_build "${TARGET_BRANCH}" "${BUILD_NODE_MEMORY_MB}" "${BUILD_MAX_WORKERS}" "${BUILD_DISABLE_SOURCE_MAP}"; then
  log "Build succeeded"
else
  BUILD_EXIT_CODE="$?"
  if [[ "${BUILD_EXIT_CODE}" -eq 137 ]]; then
    RETRY_NODE_MEMORY_MB="${NODE_BUILD_MEMORY_MB_RETRY:-384}"
    RETRY_MAX_WORKERS="${NG_BUILD_MAX_WORKERS_RETRY:-1}"
    log "Build exited with 137 (likely OOM kill). Retrying once with stricter memory settings."
    run_angular_build "${TARGET_BRANCH}" "${RETRY_NODE_MEMORY_MB}" "${RETRY_MAX_WORKERS}" "true"
  else
    fail "build failed with exit ${BUILD_EXIT_CODE}"
  fi
fi

log "Running: pm2 restart snorkelology_${TARGET_BRANCH}"
pm2 restart "snorkelology_${TARGET_BRANCH}"

log "Running: pm2 save"
pm2 save

log "Running health checks after PM2 restart..."
log "HEALTHCHECK_URL: ${HEALTHCHECK_URL}"
wait_for_pm2_online "snorkelology_${TARGET_BRANCH}" "10" "3"
wait_for_http_health "${HEALTHCHECK_URL}" "${HEALTHCHECK_TIMEOUT_SEC}" "${HEALTHCHECK_INTERVAL_SEC}"

log "SUCCESS deploy.sh deploy complete for branch ${TARGET_BRANCH}"
