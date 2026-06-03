#!/usr/bin/env bash

# If invoked with sh/dash, re-run with bash so pipefail and bash syntax work.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${REPO_ROOT}/.env}"

# import .env file
if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

# read .env variables
LOG_FILE="${LOG_FILE:-${REPO_ROOT}/logs/paypal-test.log}"
PAYPAL_NIGHTLY_BASE_URL="${PAYPAL_NIGHTLY_BASE_URL:-http://127.0.0.1:4001}"

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
echo "$(date -Iseconds) Starting paypal checks"  

# run checks
if ! output="$(PLAYWRIGHT_BASE_URL="${PAYPAL_NIGHTLY_BASE_URL}" npm run test:paypal:sandbox -- --config ./playwright.config.ts --project=chromium --workers=1 --retries=1 2>&1)"; then
  if [[ -n "${output}" ]]; then
    echo "$(date -Iseconds) ${output}"  
  fi
  exit 1
fi

echo "$(date -Iseconds) Paypal checks completed OK"  
