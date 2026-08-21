#!/usr/bin/env bash

# If invoked with sh/dash, re-run with bash so pipefail and bash syntax work.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${REPO_ROOT}/.env}"
source "${SCRIPT_DIR}/maintenance-common.sh"

# import .env file
maintenance_load_env_file "${ENV_FILE}"

# read .env variables
LOG_FILE="${LOG_FILE:-${REPO_ROOT}/logs/performance-check.log}"

mkdir -p "$(dirname -- "${LOG_FILE}")"

# move to working directory
cd "${REPO_ROOT}"

NVM_SCRIPT="${NVM_DIR:-$HOME/.nvm}/nvm.sh"
if [[ -s "${NVM_SCRIPT}" ]]; then
  # shellcheck disable=SC1090
  . "${NVM_SCRIPT}"
  nvm use >/dev/null || true
fi

# print working status
echo "$(date -Iseconds) Starting performance budget checks"  

if ! output="$(./node_modules/.bin/playwright test tests/e2e/performance.spec.js --config ./playwright.config.ts 2>&1)"; then
  maintenance_log_failure_block "Performance budget checks failed" "${output}"
  exit 1
fi

if [[ -n "${output}" ]]; then
  echo "${output}" | sed 's/^/    /'  
fi

echo "$(date -Iseconds) Performance budget checks completed OK"  
